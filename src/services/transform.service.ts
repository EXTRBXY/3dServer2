import { injectable } from 'tsyringe';
import path from 'path';
import fs from 'fs';
import { NodeIO, Document } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { Size3D } from './scene.service';

@injectable()
export class TransformService {
  private readonly modelsPath: string;
  private readonly outputPath: string;
  private readonly texturesPath: string;

  constructor() {
    this.modelsPath = path.join(process.cwd(), 'public', '3dpreview', 'models');
    this.outputPath = path.join(process.cwd(), 'public', 'WebAR');
    this.texturesPath = path.join(process.cwd(), 'public', '3dpreview', 'textures');
  }

  private isStelaMesh(name: string): boolean {
    const lowerName = name.toLowerCase();
    return lowerName.includes('node') || lowerName.includes('other');
  }

  private isStandMesh(name: string): boolean {
    return name.toLowerCase().includes('node_stand');
  }

  private isNoiseMesh(name: string): boolean {
    return name.toLowerCase().includes('other');
  }

  private convertToMeters(size: Size3D): Size3D {
    return {
      height: parseFloat(size.height as any) / 100,
      width: parseFloat(size.width as any) / 100,
      depth: parseFloat(size.depth as any) / 100
    };
  }

  private async applyTextures(
    document: Document,
    node: any,
    materialName: string,
    isNoise: boolean = false
  ): Promise<void> {
    const mesh = node.getMesh();
    if (!mesh) return;

    const baseMaterialName = materialName.replace(/\.jpg$/i, '');
    const textureName = isNoise ? `${baseMaterialName}_noise.jpg` : `${baseMaterialName}.jpg`;
    const texturePath = path.join(this.texturesPath, textureName);

    try {
      if (!fs.existsSync(texturePath)) {
        const alternateTextureName = isNoise ? `${baseMaterialName} noise.jpg` : textureName;
        const alternateTexturePath = path.join(this.texturesPath, alternateTextureName);
        
        if (fs.existsSync(alternateTexturePath)) {
          const textureImage = document.createTexture()
            .setImage(await fs.promises.readFile(alternateTexturePath))
            .setMimeType('image/jpeg');

          const material = document.createMaterial(node.getName() + '_material')
            .setBaseColorTexture(textureImage)
            .setRoughnessFactor(1.0)
            .setMetallicFactor(0.0)
            .setDoubleSided(true);

          for (const primitive of mesh.listPrimitives()) {
            primitive.setMaterial(material);
          }
          return;
        }
        
        if (isNoise) {
          const regularTexturePath = path.join(this.texturesPath, `${baseMaterialName}.jpg`);
          if (fs.existsSync(regularTexturePath)) {
            const textureImage = document.createTexture()
              .setImage(await fs.promises.readFile(regularTexturePath))
              .setMimeType('image/jpeg');

            const material = document.createMaterial(node.getName() + '_material')
              .setBaseColorTexture(textureImage)
              .setRoughnessFactor(1.0)
              .setMetallicFactor(0.0)
              .setDoubleSided(true);

            for (const primitive of mesh.listPrimitives()) {
              primitive.setMaterial(material);
            }
            return;
          }
        }
        
        const defaultTexturePath = path.join(this.texturesPath, 'Габбро-диабаз.jpg');
        if (fs.existsSync(defaultTexturePath)) {
          console.log(`Используем дефолтную текстуру: ${defaultTexturePath}`);
          const textureImage = document.createTexture()
            .setImage(await fs.promises.readFile(defaultTexturePath))
            .setMimeType('image/jpeg');

          const material = document.createMaterial(node.getName() + '_material')
            .setBaseColorTexture(textureImage)
            .setRoughnessFactor(1.0)
            .setMetallicFactor(0.0)
            .setDoubleSided(true);

          for (const primitive of mesh.listPrimitives()) {
            primitive.setMaterial(material);
          }
          return;
        }
        
        throw new Error(`Файл текстуры не найден: ${texturePath}`);
      }

      const textureImage = document.createTexture()
        .setImage(await fs.promises.readFile(texturePath))
        .setMimeType('image/jpeg');

      const material = document.createMaterial(node.getName() + '_material')
        .setBaseColorTexture(textureImage)
        .setRoughnessFactor(1.0)
        .setMetallicFactor(0.0)
        .setDoubleSided(true);

      for (const primitive of mesh.listPrimitives()) {
        primitive.setMaterial(material);
      }
    } catch (error) {
      console.error(`Ошибка при применении текстуры ${textureName}:`, error);
      
      try {
        const defaultTexturePath = path.join(this.texturesPath, 'Габбро-диабаз.jpg');
        if (fs.existsSync(defaultTexturePath)) {
          console.log(`Используем дефолтную текстуру после ошибки: ${defaultTexturePath}`);
          const textureImage = document.createTexture()
            .setImage(await fs.promises.readFile(defaultTexturePath))
            .setMimeType('image/jpeg');

          const material = document.createMaterial(node.getName() + '_material')
            .setBaseColorTexture(textureImage)
            .setRoughnessFactor(1.0)
            .setMetallicFactor(0.0)
            .setDoubleSided(true);

          for (const primitive of mesh.listPrimitives()) {
            primitive.setMaterial(material);
          }
          return;
        }
      } catch (fallbackError) {
        console.error('Ошибка при применении дефолтной текстуры:', fallbackError);
      }
      
      throw error;
    }
  }

  public async transformModel(
    modelId: string,
    stelaSize: Size3D,
    standSize: Size3D | null,
    materialName: string,
    fileName?: string
  ): Promise<string> {
    const inputFile = fileName || `${modelId}.glb`;
    const inputPath = path.join(this.modelsPath, inputFile);
    const timestamp = Date.now();
    const outputFileName = `${modelId}_${timestamp}.glb`;
    const outputPath = path.join(this.outputPath, 'glb', outputFileName);
    const outputDir = path.dirname(outputPath);

    try {
      console.log(`Обработка модели: ${modelId}`);
      console.log(`Путь к файлу: ${inputPath}`);

      const stelaSizeInMeters = this.convertToMeters(stelaSize);
      const standSizeInMeters = standSize ? this.convertToMeters(standSize) : null;

      if (!fs.existsSync(inputPath)) {
        throw new Error(`Файл модели не найден: ${inputPath}`);
      }

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
      const document = await io.read(inputPath);
      const nodes = document.getRoot().listNodes();
      
      console.log('Найденные ноды:');
      for (const node of nodes) {
        if (node.getMesh()) {
          console.log(`- Нод: ${node.getName()}`);
        }
      }
      
      const stelaMeshNodes = [];
      let standMeshNode = null;
      
      const originalData = new Map();
      
      for (const node of nodes) {
        const name = node.getName();
        
        if (node.getMesh()) {
          const originalScale = node.getScale().slice();
          const originalTranslation = node.getTranslation().slice();
          
          node.setScale([1, 1, 1] as [number, number, number]);
          node.setTranslation([0, 0, 0] as [number, number, number]);
          
          const mesh = node.getMesh();
          if (mesh) {
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            
            for (const primitive of mesh.listPrimitives()) {
              const positions = primitive.getAttribute('POSITION');
              if (positions) {
                const positionArray = positions.getArray();
                
                if (positionArray && positionArray.length > 0) {
                  for (let i = 0; i < positionArray.length; i += 3) {
                    const x = positionArray[i];
                    const y = positionArray[i + 1];
                    const z = positionArray[i + 2];
                    
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    minZ = Math.min(minZ, z);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                    maxZ = Math.max(maxZ, z);
                  }
                }
              }
            }
            
            const originalSize = {
              height: maxY - minY,
              width: maxX - minX,
              depth: maxZ - minZ
            };
            
            node.setScale(originalScale as [number, number, number]);
            node.setTranslation(originalTranslation as [number, number, number]);
            
            originalData.set(node, {
              originalSize,
              originalScale,
              originalTranslation,
              center: {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2,
                z: (minZ + maxZ) / 2
              }
            });
            
            if (this.isStandMesh(name)) {
              standMeshNode = node;
              await this.applyTextures(document, node, materialName);
            } else {
              stelaMeshNodes.push(node);
              await this.applyTextures(document, node, materialName, this.isNoiseMesh(name));
            }
          }
        }
      }

      console.log(`Найдено мешей стелы: ${stelaMeshNodes.length}`);
      console.log(`Найден меш подставки: ${standMeshNode ? 'да' : 'нет'}`);

      if (stelaMeshNodes.length > 0) {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        for (const node of stelaMeshNodes) {
          const data = originalData.get(node);
          if (data) {
            const t = node.getTranslation();
            const size = data.originalSize;
            const center = data.center;
            
            minX = Math.min(minX, t[0] + center.x - size.width/2);
            minY = Math.min(minY, t[1] + center.y - size.height/2);
            minZ = Math.min(minZ, t[2] + center.z - size.depth/2);
            maxX = Math.max(maxX, t[0] + center.x + size.width/2);
            maxY = Math.max(maxY, t[1] + center.y + size.height/2);
            maxZ = Math.max(maxZ, t[2] + center.z + size.depth/2);
          }
        }
        
        const totalSize = {
          height: maxY - minY,
          width: maxX - minX,
          depth: maxZ - minZ
        };
        
        const scaleFactors = {
          height: stelaSizeInMeters.height / totalSize.height,
          width: stelaSizeInMeters.width / totalSize.width,
          depth: stelaSizeInMeters.depth / totalSize.depth
        };

        for (const node of stelaMeshNodes) {
          const data = originalData.get(node);
          if (data) {
            const newScale = [
              data.originalScale[0] * scaleFactors.width,
              data.originalScale[1] * scaleFactors.height,
              data.originalScale[2] * scaleFactors.depth
            ] as [number, number, number];
            
            node.setScale(newScale);
          }
        }
      }

      if (standMeshNode && standSizeInMeters) {
        const data = originalData.get(standMeshNode);
        if (data) {
          const scaleFactors = {
            height: standSizeInMeters.height / data.originalSize.height,
            width: standSizeInMeters.width / data.originalSize.width,
            depth: standSizeInMeters.depth / data.originalSize.depth
          };
          
          const newScale = [
            data.originalScale[0] * scaleFactors.width,
            data.originalScale[1] * scaleFactors.height,
            data.originalScale[2] * scaleFactors.depth
          ] as [number, number, number];
          
          standMeshNode.setScale(newScale);
        }
      } else if (standMeshNode && !standSizeInMeters) {
        standMeshNode.setScale([0, 0, 0] as [number, number, number]);
      }

      if (stelaMeshNodes.length > 0) {
        for (const node of stelaMeshNodes) {
          node.setTranslation([0, 0, 0] as [number, number, number]);
        }
        if (standMeshNode) {
          standMeshNode.setTranslation([0, 0, 0] as [number, number, number]);
        }

        let stelaMinY = Infinity;
        let stelaMaxY = -Infinity;
        
        for (const node of stelaMeshNodes) {
          const data = originalData.get(node);
          if (data) {
            const s = node.getScale();
            const height = data.originalSize.height * s[1];
            const center = data.center.y * s[1];
            
            const top = center + height/2;
            const bottom = center - height/2;
            
            stelaMinY = Math.min(stelaMinY, bottom);
            stelaMaxY = Math.max(stelaMaxY, top);
          }
        }
        
        const stelaHeight = stelaMaxY - stelaMinY;

        if (standMeshNode && standSizeInMeters) {
          const standData = originalData.get(standMeshNode);
          if (standData) {
            const s = standMeshNode.getScale();
            const standHeight = standData.originalSize.height * s[1];
            
            const standTop = standHeight/1;
            
            const offsetY = standTop - stelaMinY;
            
            for (const node of stelaMeshNodes) {
              node.setTranslation([0, offsetY, 0] as [number, number, number]);
            }
          }
        } else {
          const offsetY = -stelaMinY;
          
          for (const node of stelaMeshNodes) {
            node.setTranslation([0, offsetY, 0] as [number, number, number]);
          }
        }
      }

      await io.write(outputPath, document);

      return `/WebAR/glb/${outputFileName}`;
    } catch (error) {
      throw error;
    }
  }
}