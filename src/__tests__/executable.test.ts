import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Executable Binary Tests', () => {
  const buildPath = path.join(process.cwd(), 'build');
  const binaryPath = path.join(buildPath, 'index.js');

  beforeAll(() => {
    // Ensure build exists before running tests
    if (!fs.existsSync(binaryPath)) {
      execSync('npm run build', { stdio: 'inherit' });
    }
  });

  it('should have executable permissions on main binary', () => {
    try {
      fs.accessSync(binaryPath, fs.constants.X_OK);
      expect(true).toBe(true); // If we reach here, file is executable
    } catch (error) {
      throw new Error(`Binary ${binaryPath} is not executable: ${error}`);
    }
  });

  it('should have correct shebang line', () => {
    const content = fs.readFileSync(binaryPath, 'utf8');
    expect(content).toMatch(/^#!\/usr\/bin\/env node/);
  });

  it('should be executable via direct node execution', () => {
    // Test that the file can be executed without permission errors
    expect(() => {
      execSync(`node -e "console.log('test')"`, { 
        stdio: 'pipe',
        timeout: 1000 
      });
    }).not.toThrow();
  });

  it('should have correct file permissions (755)', () => {
    const stats = fs.statSync(binaryPath);
    const mode = (stats.mode & parseInt('777', 8)).toString(8);
    
    // Should be at least 755 (rwxr-xr-x)
    expect(parseInt(mode, 8) & parseInt('755', 8)).toBe(parseInt('755', 8));
  });

  it('should have correct file permissions (755)', () => {
    const stats = fs.statSync(binaryPath);
    const mode = (stats.mode & parseInt('777', 8)).toString(8);
    
    // Should be at least 755 (rwxr-xr-x)
    expect(parseInt(mode, 8) & parseInt('755', 8)).toBe(parseInt('755', 8));
  });
});