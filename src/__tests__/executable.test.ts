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
    expect(() => {
      execSync(`timeout 3s node "${binaryPath}"`, { 
        stdio: 'pipe',
        timeout: 5000 
      });
    }).not.toThrow();
  });

  it('should start successfully when executed as binary', () => {
    expect(() => {
      execSync(`timeout 3s "${binaryPath}"`, { 
        stdio: 'pipe',
        timeout: 5000 
      });
    }).not.toThrow();
  });

  it('should work with npx local execution', () => {
    expect(() => {
      execSync(`timeout 3s npx .`, { 
        stdio: 'pipe',
        timeout: 5000,
        cwd: process.cwd()
      });
    }).not.toThrow();
  });

  it('should output expected startup message', () => {
    const output = execSync(`timeout 2s "${binaryPath}" 2>&1`, { 
      stdio: 'pipe',
      timeout: 3000 
    }).toString();
    
    expect(output).toContain('Agent Progress MCP Server running on stdio');
  });

  it('should have correct file permissions (755)', () => {
    const stats = fs.statSync(binaryPath);
    const mode = (stats.mode & parseInt('777', 8)).toString(8);
    
    // Should be at least 755 (rwxr-xr-x)
    expect(parseInt(mode, 8) & parseInt('755', 8)).toBe(parseInt('755', 8));
  });
});