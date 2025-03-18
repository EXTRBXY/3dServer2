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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadService = void 0;
const tsyringe_1 = require("tsyringe");
const three_1 = require("three");
const GLTFLoader_js_1 = require("three/examples/jsm/loaders/GLTFLoader.js");
const material_service_1 = require("./material.service");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let LoadService = class LoadService {
    constructor(materialService) {
        this.materialService = materialService;
        this.gltfLoader = new GLTFLoader_js_1.GLTFLoader();
        this.defaultTexture = 'Габбро-диабаз.jpg';
        this.modelsPath = path_1.default.join(process.cwd(), 'public', '3dpreview', 'models');
    }
    removeModel(scene) {
        if (this.model) {
            scene.remove(this.model);
            this.model = undefined;
        }
        const modelsToRemove = [];
        scene.children.forEach(child => {
            if (child.name === 'model') {
                modelsToRemove.push(child);
            }
        });
        modelsToRemove.forEach(model => {
            scene.remove(model);
        });
    }
    async loadModel({ modelId, scene }) {
        const modelPath = path_1.default.join(this.modelsPath, `${modelId}.glb`);
        try {
            console.log(`Загрузка модели: ${modelPath}`);
            if (!fs_1.default.existsSync(modelPath)) {
                console.error(`Файл модели не найден: ${modelPath}`);
                throw new Error(`Файл модели не найден: ${modelPath}`);
            }
            const buffer = fs_1.default.readFileSync(modelPath);
            console.log(`Файл модели прочитан, размер: ${buffer.length} байт`);
            return new Promise((resolve, reject) => {
                this.gltfLoader.parse(buffer, '', (gltf) => {
                    console.log('Модель успешно загружена');
                    const model = gltf.scene;
                    model.name = 'model';
                    this.model = model;
                    if (!modelId.startsWith('МК')) {
                        const materialPromises = [];
                        model.traverse((child) => {
                            if (!(child instanceof three_1.Mesh))
                                return;
                            const originalName = child.name;
                            child.userData["originalName"] = originalName;
                            const lowerName = originalName.toLowerCase();
                            if (lowerName.includes('node_stand')) {
                                child.name = 'node_stand';
                            }
                            else if (lowerName.includes('node')) {
                                child.name = 'node';
                            }
                            else {
                                child.name = 'other';
                            }
                            const materialPromise = this.materialService.createMaterial(child.name === 'other'
                                ? this.defaultTexture.replace('.jpg', ' noise.jpg')
                                : this.defaultTexture).then(material => {
                                child.material = material;
                            });
                            materialPromises.push(materialPromise);
                        });
                        Promise.all(materialPromises)
                            .then(() => resolve(model))
                            .catch(reject);
                    }
                    else {
                        model.traverse((child) => {
                            if (child instanceof three_1.Mesh && child.material) {
                                child.material.needsUpdate = true;
                            }
                        });
                        resolve(model);
                    }
                }, (error) => {
                    console.error('Ошибка при парсинге GLB модели:', error);
                    reject(error);
                });
            });
        }
        catch (error) {
            console.error('Ошибка при загрузке GLB модели:', error);
            throw error;
        }
    }
};
exports.LoadService = LoadService;
exports.LoadService = LoadService = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [material_service_1.MaterialService])
], LoadService);
