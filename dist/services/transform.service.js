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
exports.TransformService = void 0;
const tsyringe_1 = require("tsyringe");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const core_1 = require("@gltf-transform/core");
const extensions_1 = require("@gltf-transform/extensions");
let TransformService = class TransformService {
    constructor() {
        this.modelsPath = path_1.default.join(process.cwd(), 'public', '3dpreview', 'models');
        this.outputPath = path_1.default.join(process.cwd(), 'public', 'WebAR');
        this.texturesPath = path_1.default.join(process.cwd(), 'public', '3dpreview', 'textures');
    }
    isStelaMesh(name) {
        return name.toLowerCase() === 'node' || name.toLowerCase() === 'other';
    }
    isStandMesh(name) {
        return name.toLowerCase() === 'node_stand';
    }
    isNoiseMesh(name) {
        return name.toLowerCase() === 'other';
    }
    convertToMeters(size) {
        return {
            height: parseFloat(size.height) / 100,
            width: parseFloat(size.width) / 100,
            depth: parseFloat(size.depth) / 100
        };
    }
    async applyTextures(document, node, materialName, isNoise = false) {
        const mesh = node.getMesh();
        if (!mesh)
            return;
        // Определяем имя текстуры: для Other используем noise версию, для остальных обычную
        const textureName = isNoise ? `${materialName}_noise` : materialName;
        const texturePath = path_1.default.join(this.texturesPath, textureName + '.jpg');
        console.log(`Применяем текстуру ${textureName} к мешу ${node.getName()}`);
        console.log(`Путь к текстуре: ${texturePath}`);
        try {
            if (!fs_1.default.existsSync(texturePath)) {
                throw new Error(`Файл текстуры не найден: ${texturePath}`);
            }
            // Загружаем текстуру
            const textureImage = document.createTexture()
                .setImage(await fs_1.default.promises.readFile(texturePath))
                .setMimeType('image/jpeg');
            // Создаем материал
            const material = document.createMaterial(node.getName() + '_material')
                .setBaseColorTexture(textureImage)
                .setRoughnessFactor(1.0)
                .setMetallicFactor(0.0)
                .setDoubleSided(true);
            // Применяем материал ко всем примитивам меша
            for (const primitive of mesh.listPrimitives()) {
                primitive.setMaterial(material);
            }
            console.log(`Текстура успешно применена к мешу ${node.getName()}`);
        }
        catch (error) {
            console.error(`Ошибка при применении текстуры к мешу ${node.getName()}:`, error);
            throw error;
        }
    }
    async transformModel(modelId, stelaSize, standSize, materialName, fileName) {
        const inputFile = fileName || `${modelId}.glb`;
        const inputPath = path_1.default.join(this.modelsPath, inputFile);
        const timestamp = Date.now();
        const outputFileName = `${modelId}_${timestamp}.glb`;
        const outputPath = path_1.default.join(this.outputPath, 'glb', outputFileName);
        const outputDir = path_1.default.dirname(outputPath);
        try {
            // Конвертируем все размеры в метры
            const stelaSizeInMeters = this.convertToMeters(stelaSize);
            const standSizeInMeters = standSize ? this.convertToMeters(standSize) : null;
            console.log(`Трансформация модели ${modelId}`);
            console.log(`Входной файл: ${inputFile}`);
            console.log(`- Размер стелы (м): ${JSON.stringify(stelaSizeInMeters)}`);
            console.log(`- Размер подставки (м): ${standSizeInMeters ? JSON.stringify(standSizeInMeters) : 'нет'}`);
            if (!fs_1.default.existsSync(inputPath)) {
                throw new Error(`Файл модели не найден: ${inputPath}`);
            }
            if (!fs_1.default.existsSync(outputDir)) {
                fs_1.default.mkdirSync(outputDir, { recursive: true });
            }
            const io = new core_1.NodeIO().registerExtensions(extensions_1.KHRONOS_EXTENSIONS);
            const document = await io.read(inputPath);
            const nodes = document.getRoot().listNodes();
            // Собираем все меши стелы и подставки
            const stelaMeshNodes = [];
            let standMeshNode = null;
            // Сохраним оригинальные данные о мешах
            const originalData = new Map();
            // Найдем все меши, соответствующие стеле и подставке
            for (const node of nodes) {
                const name = node.getName();
                console.log(`Нода: ${name}, имеет меш: ${node.getMesh() ? 'да' : 'нет'}`);
                if (node.getMesh()) {
                    // Сохраняем оригинальные данные
                    const originalScale = node.getScale().slice();
                    const originalTranslation = node.getTranslation().slice();
                    // Сбрасываем масштаб для измерения
                    node.setScale([1, 1, 1]);
                    node.setTranslation([0, 0, 0]);
                    // Вычисляем bbox на основе меша
                    const mesh = node.getMesh();
                    if (mesh) {
                        let minX = Infinity, minY = Infinity, minZ = Infinity;
                        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
                        // Проходим по всем примитивам меша
                        for (const primitive of mesh.listPrimitives()) {
                            const positions = primitive.getAttribute('POSITION');
                            if (positions) {
                                const positionArray = positions.getArray();
                                // Находим минимальные и максимальные координаты
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
                        // Восстанавливаем оригинальный масштаб и позицию
                        node.setScale(originalScale);
                        node.setTranslation(originalTranslation);
                        // Сохраняем в оригинальные данные
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
                        console.log(`Оригинальный размер меша ${name} (м): `, originalSize);
                        // Классифицируем меш как стела или подставка
                        if (this.isStelaMesh(name)) {
                            stelaMeshNodes.push(node);
                            console.log(`Найден меш стелы: ${name}`);
                            // Применяем текстуры в зависимости от типа меша
                            await this.applyTextures(document, node, materialName, this.isNoiseMesh(name));
                        }
                        else if (this.isStandMesh(name)) {
                            standMeshNode = node;
                            console.log(`Найден меш подставки: ${name}`);
                            // Применяем текстуры к подставке
                            await this.applyTextures(document, node, materialName);
                        }
                    }
                }
            }
            // Масштабируем стелу
            if (stelaMeshNodes.length > 0) {
                // Находим общий размер стелы
                let minX = Infinity, minY = Infinity, minZ = Infinity;
                let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
                for (const node of stelaMeshNodes) {
                    const data = originalData.get(node);
                    if (data) {
                        const t = node.getTranslation();
                        const size = data.originalSize;
                        const center = data.center;
                        minX = Math.min(minX, t[0] + center.x - size.width / 2);
                        minY = Math.min(minY, t[1] + center.y - size.height / 2);
                        minZ = Math.min(minZ, t[2] + center.z - size.depth / 2);
                        maxX = Math.max(maxX, t[0] + center.x + size.width / 2);
                        maxY = Math.max(maxY, t[1] + center.y + size.height / 2);
                        maxZ = Math.max(maxZ, t[2] + center.z + size.depth / 2);
                    }
                }
                const totalSize = {
                    height: maxY - minY,
                    width: maxX - minX,
                    depth: maxZ - minZ
                };
                console.log('Общий размер стелы (м):', totalSize);
                // Вычисляем коэффициенты масштабирования (уже в метрах)
                const scaleFactors = {
                    height: stelaSizeInMeters.height / totalSize.height,
                    width: stelaSizeInMeters.width / totalSize.width,
                    depth: stelaSizeInMeters.depth / totalSize.depth
                };
                console.log('Коэффициенты масштабирования стелы:', scaleFactors);
                // Применяем масштабирование ко всем мешам стелы
                for (const node of stelaMeshNodes) {
                    const data = originalData.get(node);
                    if (data) {
                        const newScale = [
                            data.originalScale[0] * scaleFactors.width,
                            data.originalScale[1] * scaleFactors.height,
                            data.originalScale[2] * scaleFactors.depth
                        ];
                        node.setScale(newScale);
                        console.log(`Новый масштаб для ${node.getName()}: [${newScale}]`);
                    }
                }
            }
            // Масштабируем подставку
            if (standMeshNode && standSizeInMeters) {
                const data = originalData.get(standMeshNode);
                if (data) {
                    const scaleFactors = {
                        height: standSizeInMeters.height / data.originalSize.height,
                        width: standSizeInMeters.width / data.originalSize.width,
                        depth: standSizeInMeters.depth / data.originalSize.depth
                    };
                    console.log('Коэффициенты масштабирования подставки:', scaleFactors);
                    const newScale = [
                        data.originalScale[0] * scaleFactors.width,
                        data.originalScale[1] * scaleFactors.height,
                        data.originalScale[2] * scaleFactors.depth
                    ];
                    standMeshNode.setScale(newScale);
                    console.log(`Новый масштаб для подставки: [${newScale}]`);
                }
            }
            else if (standMeshNode && !standSizeInMeters) {
                standMeshNode.setScale([0, 0, 0]);
                console.log('Подставка скрыта');
            }
            // Позиционируем стелу относительно подставки
            if (stelaMeshNodes.length > 0) {
                // Сначала центрируем все по X и Z
                for (const node of stelaMeshNodes) {
                    node.setTranslation([0, 0, 0]);
                }
                if (standMeshNode) {
                    standMeshNode.setTranslation([0, 0, 0]);
                }
                // Вычисляем размеры стелы после масштабирования
                let stelaMinY = Infinity;
                let stelaMaxY = -Infinity;
                for (const node of stelaMeshNodes) {
                    const data = originalData.get(node);
                    if (data) {
                        const s = node.getScale();
                        const height = data.originalSize.height * s[1];
                        const center = data.center.y * s[1];
                        // Находим верхнюю и нижнюю точки стелы
                        const top = center + height / 2;
                        const bottom = center - height / 2;
                        stelaMinY = Math.min(stelaMinY, bottom);
                        stelaMaxY = Math.max(stelaMaxY, top);
                    }
                }
                const stelaHeight = stelaMaxY - stelaMinY;
                console.log(`Высота стелы после масштабирования (м): ${stelaHeight}`);
                console.log(`Нижняя точка стелы (м): ${stelaMinY}`);
                console.log(`Верхняя точка стелы (м): ${stelaMaxY}`);
                if (standMeshNode && standSizeInMeters) {
                    const standData = originalData.get(standMeshNode);
                    if (standData) {
                        const s = standMeshNode.getScale();
                        const standHeight = standData.originalSize.height * s[1];
                        // В клиенте подставка центрирована по Y, поэтому её верхняя точка = высота/2
                        const standTop = standHeight / 1;
                        console.log(`Высота подставки (м): ${standHeight}`);
                        console.log(`Верхняя точка подставки (м): ${standTop}`);
                        // Смещаем стелу так, чтобы её нижняя точка была на верхней точке подставки
                        const offsetY = standTop - stelaMinY;
                        console.log(`Смещение стелы (м): ${offsetY}`);
                        // Применяем смещение ко всем мешам стелы
                        for (const node of stelaMeshNodes) {
                            node.setTranslation([0, offsetY, 0]);
                        }
                    }
                }
                else {
                    // Если подставки нет, ставим стелу на уровень Y=0
                    const offsetY = -stelaMinY;
                    console.log(`Смещение стелы без подставки (м): ${offsetY}`);
                    for (const node of stelaMeshNodes) {
                        node.setTranslation([0, offsetY, 0]);
                    }
                }
            }
            await io.write(outputPath, document);
            console.log(`Модель сохранена: ${outputPath}`);
            return `/WebAR/glb/${outputFileName}`;
        }
        catch (error) {
            console.error('Ошибка при трансформации модели:', error);
            throw error;
        }
    }
};
exports.TransformService = TransformService;
exports.TransformService = TransformService = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [])
], TransformService);
