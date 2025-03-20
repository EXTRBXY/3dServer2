import { injectable } from 'tsyringe';
import { Group, Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MaterialService } from './material.service';
import path from 'path';
import fs from 'fs';

@injectable()
export class LoadService {
  private gltfLoader = new GLTFLoader();
  private defaultTexture = 'Габбро-диабаз.jpg';
  private readonly modelsPath: string;

  constructor(private readonly materialService: MaterialService) {
    this.modelsPath = path.join(process.cwd(), 'public', '3dpreview', 'models');
  }

  public async loadModel(modelId: string): Promise<Group | null> {
    const modelPath = path.join(this.modelsPath, `${modelId}.glb`);
    
    try {
      console.log(`Загрузка модели: ${modelPath}`);
      if (!fs.existsSync(modelPath)) {
        console.error(`Файл модели не найден: ${modelPath}`);
        return null;
      }
      
      const buffer = fs.readFileSync(modelPath);
      console.log(`Файл модели прочитан, размер: ${buffer.length} байт`);
      
      return new Promise<Group>((resolve, reject) => {
        this.gltfLoader.parse(
          buffer,
          '',
          (gltf) => {
            console.log('Модель успешно загружена');
            const model = gltf.scene;
            
            if (!modelId.startsWith('МК')) {
              const materialPromises: Promise<void>[] = [];
              
              model.traverse((child: Object3D) => {
                if (!(child instanceof Mesh)) return;
                
                const originalName = child.name;
                child.userData["originalName"] = originalName;
                
                const lowerName = originalName.toLowerCase();
                if (lowerName.includes('node_stand')) {
                  child.name = 'node_stand';
                } else if (lowerName.includes('node')) {
                  child.name = 'node';
                } else {
                  child.name = 'other';
                }
                
                const materialPromise = this.materialService.createMaterial(
                  child.name === 'other' 
                    ? this.defaultTexture.replace('.jpg', ' noise.jpg') 
                    : this.defaultTexture
                ).then(material => {
                  child.material = material;
                });
                
                materialPromises.push(materialPromise);
              });
              
              Promise.all(materialPromises)
                .then(() => resolve(model))
                .catch(reject);
            } else {
              model.traverse((child: Object3D) => {
                if (child instanceof Mesh && child.material) {
                  child.material.needsUpdate = true;
                }
              });
              resolve(model);
            }
          },
          (error) => {
            console.error('Ошибка при парсинге GLB модели:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Ошибка при загрузке GLB модели:', error);
      throw error;
    }
  }
} 