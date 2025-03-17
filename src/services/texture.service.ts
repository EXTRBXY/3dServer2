import { injectable } from 'tsyringe';
import { RepeatWrapping, Texture, TextureLoader } from 'three';
import path from 'path';
import fs from 'fs';

@injectable()
export class TextureService {
  private textureCache = new Map<string, Texture>();
  private readonly texturesPath: string;
  private readonly defaultTextureName = 'Габбро-диабаз.jpg';

  constructor() {
    this.texturesPath = path.join(process.cwd(), 'public', '3dpreview', 'textures');
  }

  async createTexture(textureName: string = 'Габбро-диабаз.jpg'): Promise<Texture> {
    if (this.textureCache.has(textureName)) {
      return this.textureCache.get(textureName)!;
    }

    try {
      console.log(`Загрузка текстуры: ${textureName}`);
      const texturePath = path.join(this.texturesPath, textureName);
      
      if (!fs.existsSync(texturePath)) {
        console.warn(`Текстура не найдена: ${texturePath}, использую стандартную`);
        return this.createDefaultTexture();
      }
      
      const textureData = fs.readFileSync(texturePath);
      const base64 = `data:image/jpeg;base64,${textureData.toString('base64')}`;
      
      const loader = new TextureLoader();
      const texture = loader.load(base64, (texture) => {
        this.configureTexture(texture);
      });
      
      this.textureCache.set(textureName, texture);
      return texture;
    } catch (error) {
      console.error('Ошибка при загрузке текстуры:', error);
      return this.createDefaultTexture();
    }
  }

  private async createDefaultTexture(): Promise<Texture> {
    if (this.textureCache.has(this.defaultTextureName)) {
      return this.textureCache.get(this.defaultTextureName)!;
    }

    try {
      const defaultTexturePath = path.join(this.texturesPath, this.defaultTextureName);
      const textureData = fs.readFileSync(defaultTexturePath);
      const base64 = `data:image/jpeg;base64,${textureData.toString('base64')}`;
      
      const loader = new TextureLoader();
      const texture = loader.load(base64, (texture) => {
        this.configureTexture(texture);
      });
      
      this.textureCache.set(this.defaultTextureName, texture);
      return texture;
    } catch (error) {
      console.error('Ошибка при загрузке стандартной текстуры:', error);
      
      // Создаем пустую текстуру как последнее средство
      const texture = new Texture();
      this.configureTexture(texture);
      return texture;
    }
  }

  private configureTexture(texture: Texture): void {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.flipY = false;
    texture.needsUpdate = true;
  }
} 