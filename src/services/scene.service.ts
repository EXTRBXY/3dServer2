import { injectable } from 'tsyringe';
import {
  Box3,
  Color,
  Group,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  AmbientLight,
  DirectionalLight,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { LoadService } from './load.service';
import { MaterialService } from './material.service';

export interface Size3D {
  height: number;
  width: number;
  depth: number;
}

@injectable()
export class SceneService {
  private scene = new Scene();
  private camera = new PerspectiveCamera(45, 1, 0.25, 20);
  private _stelaSize: Size3D = { height: 80, width: 40, depth: 5 };
  private _standSize: Size3D | null = null;
  private cameraTarget: Vector3 = new Vector3(0, 0.5, 0);
  private originalMeshData = new Map<Mesh, { 
    originalSize: Size3D,
    originalScale: Vector3,
    originalPosition: Vector3
  }>();

  constructor(
    private readonly loadService: LoadService, 
    private readonly materialService: MaterialService
  ) {
    this.initScene();
  }

  private initScene() {
    // Настройка сцены
    this.scene.background = new Color(0xffffff);
    
    // Настройка камеры
    this.camera.position.set(-2.2, 1.44, -2.2);
    this.camera.lookAt(this.cameraTarget);
    
    // Добавление освещения
    const ambientLight = new AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    const directionalLight = new DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
  }

  public getScene(): Scene {
    return this.scene;
  }

  private getWorldBoundingBox(object: Object3D): Box3 {
    return new Box3().setFromObject(object);
  }

  get stelaSize(): Size3D {
    return this._stelaSize;
  }

  set stelaSize(value: Size3D | null) {
    if (value === null) return;
    console.log(`Установка размеров стелы: ${JSON.stringify(value)}`);
    this._stelaSize = value;
    this.updateStelaSize();
    this.updateCameraPosition();
  }

  get standSize(): Size3D | null {
    return this._standSize;
  }

  set standSize(value: Size3D | null) {
    console.log(`Установка размеров подставки: ${value ? JSON.stringify(value) : 'null'}`);
    this._standSize = value;
    this.updateStandVisibility();
    if (value) {
      this.updateStandSize();
    }
    this.updateCameraPosition();
  }

  private saveOriginalModelState() {
    console.log('Сохранение исходного состояния модели');
    this.originalMeshData.clear();
    
    this.getModelObject()?.traverse((object) => {
      if (object instanceof Mesh) {
        if (this.isStelaOrStandMesh(object)) {
          const originalScale = object.scale.clone();
          const originalPosition = object.position.clone();
          
          object.scale.set(1, 1, 1);
          
          const boundingBox = new Box3().setFromObject(object);
          const originalSize = {
            height: boundingBox.max.y - boundingBox.min.y,
            width: boundingBox.max.x - boundingBox.min.x,
            depth: boundingBox.max.z - boundingBox.min.z
          };
          
          object.scale.copy(originalScale);
          
          this.originalMeshData.set(object, {
            originalSize,
            originalScale,
            originalPosition
          });
          
          console.log(`Сохранены данные для меша ${object.name}: размер=${JSON.stringify(originalSize)}`);
        }
      }
    });
  }

  private isStelaOrStandMesh(mesh: Mesh): boolean {
    return mesh.name === 'node' || mesh.name === 'other' || mesh.name === 'node_stand';
  }

  private isStelaMesh(mesh: Mesh): boolean {
    return mesh.name === 'node' || mesh.name === 'other';
  }

  private isStandMesh(mesh: Mesh): boolean {
    return mesh.name === 'node_stand';
  }

  private getModelObject(): Object3D | undefined {
    return this.scene.children.find(child => child.name === 'model');
  }

  private collectMeshes(): { stelaMeshes: Mesh[], standMesh: Mesh | null } {
    const stelaMeshes: Mesh[] = [];
    let standMesh: Mesh | null = null;
    
    this.getModelObject()?.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      
      if (this.isStandMesh(object)) {
        standMesh = object;
      } else if (this.isStelaMesh(object)) {
        stelaMeshes.push(object);
      }
    });
    
    return { stelaMeshes, standMesh };
  }

  private updateStelaSize() {
    console.log('Обновление размеров стелы');
    if (this.originalMeshData.size === 0) {
      this.saveOriginalModelState();
    }
    
    const { stelaMeshes, standMesh } = this.collectMeshes();
    if (stelaMeshes.length === 0) {
      console.log('Не найдены меши стелы для изменения размеров');
      return;
    }
    
    const tempGroup = new Group();
    stelaMeshes.forEach(mesh => {
      const clone = mesh.clone();
      clone.scale.set(1, 1, 1);
      clone.position.set(0, 0, 0);
      tempGroup.add(clone);
    });
    
    const originalBBox = new Box3().setFromObject(tempGroup);
    const originalSize = {
      height: originalBBox.max.y - originalBBox.min.y,
      width: originalBBox.max.x - originalBBox.min.x,
      depth: originalBBox.max.z - originalBBox.min.z
    };
    
    const scaleFactors = {
      height: this._stelaSize.height / (originalSize.height * 100),
      width: this._stelaSize.width / (originalSize.width * 100),
      depth: this._stelaSize.depth / (originalSize.depth * 100)
    };
    
    console.log(`Исходный размер стелы: ${JSON.stringify(originalSize)}`);
    console.log(`Коэффициенты масштабирования: ${JSON.stringify(scaleFactors)}`);
    
    tempGroup.clear();
    
    stelaMeshes.forEach(mesh => {
      const originalData = this.originalMeshData.get(mesh);
      if (originalData) {
        mesh.position.copy(originalData.originalPosition);
        
        mesh.scale.set(
          originalData.originalScale.x * scaleFactors.width,
          originalData.originalScale.y * scaleFactors.height,
          originalData.originalScale.z * scaleFactors.depth
        );
        
        console.log(`Обновлен масштаб для меша ${mesh.name}: ${mesh.scale.x}, ${mesh.scale.y}, ${mesh.scale.z}`);
      }
    });
    
    if (standMesh) {
      const standBBox = new Box3().setFromObject(standMesh);
      
      const stelaGroup = new Group();
      stelaMeshes.forEach(mesh => stelaGroup.add(mesh.clone()));
      const stelaBBox = new Box3().setFromObject(stelaGroup);
      
      stelaGroup.clear();
      
      const offsetY = this._standSize
        ? standBBox.max.y - stelaBBox.min.y
        : -stelaBBox.min.y;
      
      stelaMeshes.forEach(mesh => {
        mesh.position.y += offsetY;
        console.log(`Обновлена позиция для меша ${mesh.name}: y += ${offsetY}`);
      });
    }
  }

  private updateStandSize() {
    console.log('Обновление размеров подставки');
    if (this.originalMeshData.size === 0) {
      this.saveOriginalModelState();
    }
    
    const { standMesh } = this.collectMeshes();
    if (!standMesh || !this._standSize) {
      console.log('Не найден меш подставки для изменения размеров');
      return;
    }
    
    const originalData = this.originalMeshData.get(standMesh);
    if (originalData) {
      standMesh.position.copy(originalData.originalPosition);
      
      const scaleFactors = {
        height: this._standSize.height / (originalData.originalSize.height * 100),
        width: this._standSize.width / (originalData.originalSize.width * 100),
        depth: this._standSize.depth / (originalData.originalSize.depth * 100)
      };
      
      console.log(`Исходный размер подставки: ${JSON.stringify(originalData.originalSize)}`);
      console.log(`Коэффициенты масштабирования подставки: ${JSON.stringify(scaleFactors)}`);
      
      standMesh.scale.set(
        originalData.originalScale.x * scaleFactors.width,
        originalData.originalScale.y * scaleFactors.height,
        originalData.originalScale.z * scaleFactors.depth
      );
      
      console.log(`Обновлен масштаб для подставки: ${standMesh.scale.x}, ${standMesh.scale.y}, ${standMesh.scale.z}`);
    }
    
    this.updateStelaSize();
  }
  
  private updateStandVisibility() {
    console.log(`Обновление видимости подставки: ${this._standSize !== null}`);
    const { stelaMeshes, standMesh } = this.collectMeshes();
    
    if (standMesh) {
      standMesh.visible = this._standSize !== null;
      
      if (stelaMeshes.length > 0) {
        const standBBox = this.getWorldBoundingBox(standMesh);
        
        const stelaGroup = new Group();
        stelaMeshes.forEach(mesh => stelaGroup.add(mesh.clone()));
        const stelaBBox = this.getWorldBoundingBox(stelaGroup);
        
        stelaGroup.clear();
        
        const offsetY = this._standSize !== null
          ? standBBox.max.y - stelaBBox.min.y 
          : -stelaBBox.min.y;
        
        stelaMeshes.forEach(mesh => {
          mesh.position.y += offsetY;
          console.log(`Обновлена позиция для меша ${mesh.name} при изменении видимости подставки: y += ${offsetY}`);
        });
      }
    }
  }
  
  private updateCameraPosition(): void {
    console.log('Обновление позиции камеры');
    
    const model = this.getModelObject();
    if (!model) {
      console.log('Модель не найдена для обновления позиции камеры');
      return;
    }
    
    const boundingBox = new Box3().setFromObject(model);
    const size = new Vector3();
    boundingBox.getSize(size);
    
    this.cameraTarget.set(0, boundingBox.min.y + size.y / 2, 0);
    
    const distance = Math.max(size.x, size.y, size.z) * 1.5;
    const cameraDistance = Math.max(2.2, distance);
    
    const direction = new Vector3(-1, 1, -1).normalize();
    this.camera.position.copy(direction.multiplyScalar(cameraDistance).add(this.cameraTarget));
    
    this.camera.lookAt(this.cameraTarget);
    
    console.log(`Новая позиция камеры: ${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z}`);
    console.log(`Цель камеры: ${this.cameraTarget.x}, ${this.cameraTarget.y}, ${this.cameraTarget.z}`);
  }

  public async initModel(modelId: string) {
    console.log(`Инициализация модели: ${modelId}`);
    this.clearScene();
    
    const model = await this.loadService.loadModel({ modelId, scene: this.scene });
    this.scene.add(model);
    
    this.saveOriginalModelState();
    this.updateStelaSize();
    this.updateCameraPosition();
    
    console.log('Модель успешно инициализирована');
    return model;
  }
  
  private clearScene() {
    console.log('Очистка сцены');
    this.scene.children.forEach(child => {
      if(child.name === 'model') {
        this.scene.remove(child);
      }
    });
    this.loadService.removeModel(this.scene);
    this.originalMeshData.clear();
  }

  public async changeMaterial(materialName: string) {
    console.log(`Изменение материала на: ${materialName}`);
    const model = this.getModelObject();
    if (!model) {
      console.log('Модель не найдена для изменения материала');
      return;
    }
    
    await this.materialService.changeMaterial(model, materialName);
  }
  
  /**
   * Экспортирует текущую сцену в формат GLB
   * @returns ArrayBuffer с данными GLB файла
   */
  public async exportToGLB(): Promise<ArrayBuffer> {
    console.log('Экспорт сцены в GLB формат');
    
    const gltfExporter = new GLTFExporter();
    
    return new Promise<ArrayBuffer>((resolve, reject) => {
      try {
        console.log('Начало экспорта GLB');
        gltfExporter.parse(
          this.scene, 
          (result) => {
            console.log('GLB экспорт успешно завершен');
            resolve(result as ArrayBuffer);
          },
          (error) => {
            console.error('Ошибка при экспорте GLB:', error);
            reject(error);
          },
          { binary: true }
        );
      } catch (error) {
        console.error('Ошибка при вызове GLTFExporter.parse:', error);
        reject(error);
      }
    });
  }
} 