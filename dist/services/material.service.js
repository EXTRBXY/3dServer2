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
exports.MaterialService = void 0;
const tsyringe_1 = require("tsyringe");
const texture_service_1 = require("./texture.service");
const three_1 = require("three");
let MaterialService = class MaterialService {
    constructor(textureService) {
        this.textureService = textureService;
        this.materialCache = new Map();
    }
    async changeMaterial(model, textureName) {
        if (!model.children?.length || !this.isEditableModel(model.name))
            return;
        console.log(`Изменение материала модели на ${textureName}`);
        for (const child of model.children) {
            if (!(child instanceof three_1.Mesh))
                continue;
            const meshName = child.name.toLowerCase();
            const finalTextureName = meshName.includes('other')
                ? this.getNoiseVariant(textureName)
                : textureName;
            console.log(`Применение текстуры ${finalTextureName} к элементу ${child.name}`);
            child.material = await this.createMaterial(finalTextureName);
        }
    }
    isEditableModel(modelName) {
        return modelName.startsWith('ПВ') || modelName.startsWith('ПГ') || modelName === 'model';
    }
    async createMaterial(textureName) {
        if (this.materialCache.has(textureName)) {
            return this.materialCache.get(textureName);
        }
        console.log(`Создание материала с текстурой ${textureName}`);
        const material = new three_1.MeshStandardMaterial({
            map: await this.textureService.createTexture(textureName),
            name: textureName,
            metalness: 0.8,
            roughness: 0.5
        });
        this.materialCache.set(textureName, material);
        return material;
    }
    getNoiseVariant(textureName) {
        if (textureName.includes('noise'))
            return textureName;
        return textureName.replace(/\.jpg$/i, ' noise.jpg');
    }
};
exports.MaterialService = MaterialService;
exports.MaterialService = MaterialService = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [texture_service_1.TextureService])
], MaterialService);
