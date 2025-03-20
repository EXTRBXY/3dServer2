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
    this.scene.background = new Color(0xffffff);
    
    this.camera.position.set(-2.2, 1.44, -2.2);
    this.camera.lookAt(this.cameraTarget);
    
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
    this._stelaSize = value;
    this.updateStelaSize();
    this.updateCameraPosition();
  }

  get standSize(): Size3D | null {
    return this._standSize;
  }

  set standSize(value: Size3D | null) {
    this._standSize = value;
    this.updateStandVisibility();
    if (value) {
      this.updateStandSize();
    }
    this.updateCameraPosition();
  }

  private saveOriginalModelState() {
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
    if (this.originalMeshData.size === 0) {
      this.saveOriginalModelState();
    }
    
    const { stelaMeshes, standMesh } = this.collectMeshes();
    if (stelaMeshes.length === 0) {
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
      });
    }
  }

  private updateStandSize() {
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
      
      
      standMesh.scale.set(
        originalData.originalScale.x * scaleFactors.width,
        originalData.originalScale.y * scaleFactors.height,
        originalData.originalScale.z * scaleFactors.depth
      );
      
    }
    
    this.updateStelaSize();
  }
  
  private updateStandVisibility() {
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
        });
      }
    }
  }
  
  private updateCameraPosition(): void {
    
    const model = this.getModelObject();
    if (!model) {
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
    
  }

  public async initModel(modelId: string) {
    this.clearScene();
    
    const model = await this.loadService.loadModel({ modelId, scene: this.scene });
    this.scene.add(model);
    
    this.saveOriginalModelState();
    this.updateStelaSize();
    this.updateCameraPosition();
    
    return model;
  }
  
  private clearScene() {
    this.scene.children.forEach(child => {
      if(child.name === 'model') {
        this.scene.remove(child);
      }
    });
    this.loadService.removeModel(this.scene);
    this.originalMeshData.clear();
  }

  public async changeMaterial(materialName: string) {
    const model = this.getModelObject();
    if (!model) {
      return;
    }
    
    await this.materialService.changeMaterial(model, materialName);
  }

  public async exportToGLB(): Promise<ArrayBuffer> {
    
    const gltfExporter = new GLTFExporter();
    
    return new Promise<ArrayBuffer>((resolve, reject) => {
      try {
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
        reject(error);
      }
    });
  }
} 