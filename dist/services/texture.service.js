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
exports.TextureService = void 0;
const tsyringe_1 = require("tsyringe");
const three_1 = require("three");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let TextureService = class TextureService {
    constructor() {
        this.textureCache = new Map();
        this.defaultTextureName = 'Габбро-диабаз.jpg';
        this.texturesPath = path_1.default.join(process.cwd(), 'public', '3dpreview', 'textures');
    }
    async createTexture(textureName = 'Габбро-диабаз.jpg') {
        if (this.textureCache.has(textureName)) {
            return this.textureCache.get(textureName);
        }
        try {
            console.log(`Загрузка текстуры: ${textureName}`);
            const texturePath = path_1.default.join(this.texturesPath, textureName);
            if (!fs_1.default.existsSync(texturePath)) {
                console.warn(`Текстура не найдена: ${texturePath}, использую стандартную`);
                return this.createDefaultTexture();
            }
            const textureData = fs_1.default.readFileSync(texturePath);
            const base64 = `data:image/jpeg;base64,${textureData.toString('base64')}`;
            const loader = new three_1.TextureLoader();
            const texture = loader.load(base64, (texture) => {
                this.configureTexture(texture);
            });
            this.textureCache.set(textureName, texture);
            return texture;
        }
        catch (error) {
            console.error('Ошибка при загрузке текстуры:', error);
            return this.createDefaultTexture();
        }
    }
    async createDefaultTexture() {
        if (this.textureCache.has(this.defaultTextureName)) {
            return this.textureCache.get(this.defaultTextureName);
        }
        try {
            const defaultTexturePath = path_1.default.join(this.texturesPath, this.defaultTextureName);
            const textureData = fs_1.default.readFileSync(defaultTexturePath);
            const base64 = `data:image/jpeg;base64,${textureData.toString('base64')}`;
            const loader = new three_1.TextureLoader();
            const texture = loader.load(base64, (texture) => {
                this.configureTexture(texture);
            });
            this.textureCache.set(this.defaultTextureName, texture);
            return texture;
        }
        catch (error) {
            console.error('Ошибка при загрузке стандартной текстуры:', error);
            // Создаем пустую текстуру как последнее средство
            const texture = new three_1.Texture();
            this.configureTexture(texture);
            return texture;
        }
    }
    configureTexture(texture) {
        texture.wrapS = three_1.RepeatWrapping;
        texture.wrapT = three_1.RepeatWrapping;
        texture.flipY = false;
        texture.needsUpdate = true;
    }
};
exports.TextureService = TextureService;
exports.TextureService = TextureService = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [])
], TextureService);
