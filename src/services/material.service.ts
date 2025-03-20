import { injectable } from 'tsyringe';
import { TextureService } from './texture.service';
import { Mesh, MeshStandardMaterial, Object3D, Object3DEventMap } from 'three';

@injectable()
export class MaterialService {
  private materialCache = new Map<string, MeshStandardMaterial>();

  constructor(private readonly textureService: TextureService) {}

  async changeMaterial(model: Object3D<Object3DEventMap>, textureName: string) {
    if (!model.children?.length || !this.isEditableModel(model.name)) return;

    for (const child of model.children) {
      if (!(child instanceof Mesh)) continue;
      
      const meshName = child.name.toLowerCase();
      const finalTextureName = meshName.includes('other') 
        ? this.getNoiseVariant(textureName) 
        : textureName;
      
      child.material = await this.createMaterial(finalTextureName);
    }
  }

  private isEditableModel(modelName: string): boolean {
    return modelName.startsWith('ПВ') || modelName.startsWith('ПГ') || modelName === 'model';
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