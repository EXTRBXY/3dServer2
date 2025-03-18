"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneService = void 0;
const tsyringe_1 = require("tsyringe");
const three_1 = require("three");
const GLTFExporter_js_1 = require("three/examples/jsm/exporters/GLTFExporter.js");
const load_service_1 = require("./load.service");
const material_service_1 = require("./material.service");
let SceneService = class SceneService {
    constructor(loadService, materialService) {
        this.loadService = loadService;
        this.materialService = materialService;
        this.scene = new three_1.Scene();
        this.camera = new three_1.PerspectiveCamera(45, 1, 0.25, 20);
        this._stelaSize = { height: 80, width: 40, depth: 5 };
        this._standSize = null;
        this.cameraTarget = new three_1.Vector3(0, 0.5, 0);
        this.originalMeshData = new Map();
        this.initScene();
    }
    initScene() {
        // Настройка сцены
        this.scene.background = new three_1.Color(0xffffff);
        // Настройка камеры
        this.camera.position.set(-2.2, 1.44, -2.2);
        this.camera.lookAt(this.cameraTarget);
        // Добавление освещения
        const ambientLight = new three_1.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        const directionalLight = new three_1.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
    }
    getScene() {
        return this.scene;
    }
    getWorldBoundingBox(object) {
        return new three_1.Box3().setFromObject(object);
    }
    get stelaSize() {
        return this._stelaSize;
    }
    set stelaSize(value) {
        if (value === null)
            return;
        console.log(`Установка размеров стелы: ${JSON.stringify(value)}`);
        this._stelaSize = value;
        this.updateStelaSize();
        this.updateCameraPosition();
    }
    get standSize() {
        return this._standSize;
    }
    set standSize(value) {
        console.log(`Установка размеров подставки: ${value ? JSON.stringify(value) : 'null'}`);
        this._standSize = value;
        this.updateStandVisibility();
        if (value) {
            this.updateStandSize();
        }
        this.updateCameraPosition();
    }
    saveOriginalModelState() {
        console.log('Сохранение исходного состояния модели');
        this.originalMeshData.clear();
        this.getModelObject()?.traverse((object) => {
            if (object instanceof three_1.Mesh) {
                if (this.isStelaOrStandMesh(object)) {
                    const originalScale = object.scale.clone();
                    const originalPosition = object.position.clone();
                    object.scale.set(1, 1, 1);
                    const boundingBox = new three_1.Box3().setFromObject(object);
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
    isStelaOrStandMesh(mesh) {
        return mesh.name === 'node' || mesh.name === 'other' || mesh.name === 'node_stand';
    }
    isStelaMesh(mesh) {
        return mesh.name === 'node' || mesh.name === 'other';
    }
    isStandMesh(mesh) {
        return mesh.name === 'node_stand';
    }
    getModelObject() {
        return this.scene.children.find(child => child.name === 'model');
    }
    collectMeshes() {
        const stelaMeshes = [];
        let standMesh = null;
        this.getModelObject()?.traverse((object) => {
            if (!(object instanceof three_1.Mesh))
                return;
            if (this.isStandMesh(object)) {
                standMesh = object;
            }
            else if (this.isStelaMesh(object)) {
                stelaMeshes.push(object);
            }
        });
        return { stelaMeshes, standMesh };
    }
    updateStelaSize() {
        console.log('Обновление размеров стелы');
        if (this.originalMeshData.size === 0) {
            this.saveOriginalModelState();
        }
        const { stelaMeshes, standMesh } = this.collectMeshes();
        if (stelaMeshes.length === 0) {
            console.log('Не найдены меши стелы для изменения размеров');
            return;
        }
        const tempGroup = new three_1.Group();
        stelaMeshes.forEach(mesh => {
            const clone = mesh.clone();
            clone.scale.set(1, 1, 1);
            clone.position.set(0, 0, 0);
            tempGroup.add(clone);
        });
        const originalBBox = new three_1.Box3().setFromObject(tempGroup);
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
                mesh.scale.set(originalData.originalScale.x * scaleFactors.width, originalData.originalScale.y * scaleFactors.height, originalData.originalScale.z * scaleFactors.depth);
                console.log(`Обновлен масштаб для меша ${mesh.name}: ${mesh.scale.x}, ${mesh.scale.y}, ${mesh.scale.z}`);
            }
        });
        if (standMesh) {
            const standBBox = new three_1.Box3().setFromObject(standMesh);
            const stelaGroup = new three_1.Group();
            stelaMeshes.forEach(mesh => stelaGroup.add(mesh.clone()));
            const stelaBBox = new three_1.Box3().setFromObject(stelaGroup);
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
    updateStandSize() {
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
            standMesh.scale.set(originalData.originalScale.x * scaleFactors.width, originalData.originalScale.y * scaleFactors.height, originalData.originalScale.z * scaleFactors.depth);
            console.log(`Обновлен масштаб для подставки: ${standMesh.scale.x}, ${standMesh.scale.y}, ${standMesh.scale.z}`);
        }
        this.updateStelaSize();
    }
    updateStandVisibility() {
        console.log(`Обновление видимости подставки: ${this._standSize !== null}`);
        const { stelaMeshes, standMesh } = this.collectMeshes();
        if (standMesh) {
            standMesh.visible = this._standSize !== null;
            if (stelaMeshes.length > 0) {
                const standBBox = this.getWorldBoundingBox(standMesh);
                const stelaGroup = new three_1.Group();
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
    updateCameraPosition() {
        console.log('Обновление позиции камеры');
        const model = this.getModelObject();
        if (!model) {
            console.log('Модель не найдена для обновления позиции камеры');
            return;
        }
        const boundingBox = new three_1.Box3().setFromObject(model);
        const size = new three_1.Vector3();
        boundingBox.getSize(size);
        this.cameraTarget.set(0, boundingBox.min.y + size.y / 2, 0);
        const distance = Math.max(size.x, size.y, size.z) * 1.5;
        const cameraDistance = Math.max(2.2, distance);
        const direction = new three_1.Vector3(-1, 1, -1).normalize();
        this.camera.position.copy(direction.multiplyScalar(cameraDistance).add(this.cameraTarget));
        this.camera.lookAt(this.cameraTarget);
        console.log(`Новая позиция камеры: ${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z}`);
        console.log(`Цель камеры: ${this.cameraTarget.x}, ${this.cameraTarget.y}, ${this.cameraTarget.z}`);
    }
    async initModel(modelId) {
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
    clearScene() {
        console.log('Очистка сцены');
        this.scene.children.forEach(child => {
            if (child.name === 'model') {
                this.scene.remove(child);
            }
        });
        this.loadService.removeModel(this.scene);
        this.originalMeshData.clear();
    }
    async changeMaterial(materialName) {
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
    async exportToGLB() {
        console.log('Экспорт сцены в GLB формат');
        const gltfExporter = new GLTFExporter_js_1.GLTFExporter();
        return new Promise((resolve, reject) => {
            try {
                console.log('Начало экспорта GLB');
                gltfExporter.parse(this.scene, (result) => {
                    console.log('GLB экспорт успешно завершен');
                    resolve(result);
                }, (error) => {
                    console.error('Ошибка при экспорте GLB:', error);
                    reject(error);
                }, { binary: true });
            }
            catch (error) {
                console.error('Ошибка при вызове GLTFExporter.parse:', error);
                reject(error);
            }
        });
    }
};
exports.SceneService = SceneService;
exports.SceneService = SceneService = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [load_service_1.LoadService,
        material_service_1.MaterialService])
], SceneService);
