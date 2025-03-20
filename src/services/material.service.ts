import { injectable } from 'tsyringe';
import { TextureService } from './texture.service';
import { Mesh, MeshStandardMaterial, Object3D } from 'three';

@injectable()
export class MaterialService {
  private materialCache = new Map<string, MeshStandardMaterial>();

  constructor(private readonly textureService: TextureService) {}

  async applyMaterial(model: Object3D, textureName: string) {
    model.traverse(async (child) => {
      if (!(child instanceof Mesh)) return;
      
      const meshName = child.name.toLowerCase();
      const finalTextureName = meshName.includes('other') 
        ? this.getNoiseVariant(textureName) 
        : textureName;
      
      child.material = await this.createMaterial(finalTextureName);
    });
  }

  async createMaterial(textureName: string) {
    if (this.materialCache.has(textureName)) {
      return this.materialCache.get(textureName)!;
    }

    const material = new MeshStandardMaterial({
      map: await this.textureService.createTexture(textureName),
      name: textureName,
      metalness: 0.8,
      roughness: 0.5
    });
    
    this.materialCache.set(textureName, material);
    return material;
  }

  private getNoiseVariant(textureName: string): string {
    if (textureName.includes('noise')) return textureName;
    return textureName.replace(/\.jpg$/i, ' noise.jpg');
  }
} 