import { injectable } from 'tsyringe';
import { createHash } from 'crypto';

export interface ModelParameters {
  modelId: string;
  stelaSize: {
    width: number;
    height: number;
    depth: number;
  };
  standSize?: {
    width: number;
    height: number;
    depth: number;
  } | null;
  materialName: string;
}

@injectable()
export class HashService {
  generateModelHash(params: ModelParameters): string {
    const stelaSize = `${params.stelaSize.width.toFixed(2)}_${params.stelaSize.height.toFixed(2)}_${params.stelaSize.depth.toFixed(2)}`;
    
    let standSize = 'no_stand';
    if (params.standSize) {
      standSize = `${params.standSize.width.toFixed(2)}_${params.standSize.height.toFixed(2)}_${params.standSize.depth.toFixed(2)}`;
    }
    
    const materialName = params.materialName.replace(/\.jpg$/i, '').toLowerCase();
    
    const hashString = `${params.modelId}_${stelaSize}_${standSize}_${materialName}`;
    
    const hash = createHash('sha256').update(hashString).digest('hex').substring(0, 10);
    
    return hash;
  }
  
  generateFileName(params: ModelParameters, extension: string): string {
    const hash = this.generateModelHash(params);
    return `${params.modelId}_${hash}.${extension}`;
  }
} 