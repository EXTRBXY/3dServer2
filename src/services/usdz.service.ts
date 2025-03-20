import { injectable } from 'tsyringe';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

@injectable()
export class USDZService {
  private readonly outputPath: string;
  private readonly dockerImage = 'marlon360/usd-from-gltf:latest';

  constructor() {
    this.outputPath = path.join(process.cwd(), 'public', 'WebAR', 'usdz');
  }

  public async convertToUSDZ(glbPath: string): Promise<string | null> {
    try {
      if (!glbPath.startsWith('/WebAR/glb/')) {
        return null;
      }

      const absoluteGlbPath = path.join(process.cwd(), 'public', glbPath);
      
      if (!fs.existsSync(absoluteGlbPath)) {
        return null;
      }

      const glbFileName = path.basename(glbPath);
      const fileName = path.basename(glbFileName, '.glb');
      const usdzFileName = `${fileName}.usdz`;
      const usdzFilePath = path.join(this.outputPath, usdzFileName);

      if (!fs.existsSync(this.outputPath)) {
        fs.mkdirSync(this.outputPath, { recursive: true });
      }

      const inputDir = path.dirname(absoluteGlbPath);
      const dockerCmd = `docker run --rm -v "${inputDir}:/usr/src/input" -v "${this.outputPath}:/usr/src/output" ${this.dockerImage} /usr/src/input/${glbFileName} /usr/src/output/${usdzFileName}`;
      
      await execPromise(dockerCmd);

      if (fs.existsSync(usdzFilePath)) {
        return `/WebAR/usdz/${usdzFileName}`;
      }

      return null;

    } catch (error) {
      return null;
    }
  }
}