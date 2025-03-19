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
    }
    isStelaOrStandMesh(name) {
        return name.toLowerCase() === 'node' || name.toLowerCase() === 'other' || name.toLowerCase() === 'node_stand';
    }
    isStelaMesh(name) {
        return name.toLowerCase() === 'node' || name.toLowerCase() === 'other';
    }
    isStandMesh(name) {
        return name.toLowerCase() === 'node_stand';
    }
    /**
     * Трансформирует модель, применяя изменения размеров стелы и подставки
     */
    async transformModel(modelId, stelaSize, standSize, materialName, fileName) {
        // Если передано имя файла, используем его, иначе формируем по modelId
        const inputFile = fileName || `${modelId}.glb`;
        const inputPath = path_1.default.join(this.modelsPath, inputFile);
        const timestamp = Date.now();
        const outputFileName = `${modelId}_${timestamp}.glb`;
        const outputPath = path_1.default.join(this.outputPath, 'glb', outputFileName);
        const outputDir = path_1.default.dirname(outputPath);
        try {
            console.log(`Трансформация модели ${modelId}`);
            console.log(`Входной файл: ${inputFile}`);
            console.log(`- Размер стелы: ${JSON.stringify(stelaSize)}`);
            console.log(`- Размер подставки: ${standSize ? JSON.stringify(standSize) : 'нет'}`);
            // Проверяем наличие входного файла
            if (!fs_1.default.existsSync(inputPath)) {
                throw new Error(`Файл модели не найден: ${inputPath}`);
            }
            // Создаем директорию для вывода, если она не существует
            if (!fs_1.default.existsSync(outputDir)) {
                fs_1.default.mkdirSync(outputDir, { recursive: true });
            }
            // Загружаем GLB с помощью gltf-transform
            const io = new core_1.NodeIO().registerExtensions(extensions_1.KHRONOS_EXTENSIONS);
            const document = await io.read(inputPath);
            // Получаем все ноды в модели
            const nodes = document.getRoot().listNodes();
            const meshes = document.getRoot().listMeshes();
            console.log(`Количество нод: ${nodes.length}`);
            console.log(`Количество мешей: ${meshes.length}`);
            // Собираем все меши стелы и подставки
            const stelaMeshNodes = [];
            let standMeshNode = null;
            // Сохраним оригинальные данные о мешах
            const originalData = new Map();
            // Найдем все меши, соответствующие стеле и подставке
            for (const node of nodes) {
                const name = node.getName();
                console.log(`Нода: ${name}, имеет меш: ${node.getMesh() ? 'да' : 'нет'}`);
                // Проверяем имя ноды и наличие меша
                if (node.getMesh()) {
                    // Сохраняем оригинальные данные
                    const originalScale = node.getScale().slice();
                    const originalTranslation = node.getTranslation().slice();
                    // Определяем оригинальный размер меша
                    node.setScale([1, 1, 1]); // Сбрасываем масштаб для измерения
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
                        // Восстанавливаем оригинальный масштаб
                        node.setScale(originalScale);
                        // Сохраняем в оригинальные данные
                        originalData.set(node, {
                            originalSize,
                            originalScale,
                            originalTranslation
                        });
                        console.log(`Оригинальный размер меша ${name}: `, originalSize);
                        // Классифицируем меш как стела или подставка
                        if (this.isStelaMesh(name)) {
                            stelaMeshNodes.push(node);
                            console.log(`Найден меш стелы: ${name}`);
                        }
                        else if (this.isStandMesh(name)) {
                            standMeshNode = node;
                            console.log(`Найден меш подставки: ${name}`);
                        }
                    }
                }
            }
            // Если не нашли меши по имени, попробуем определить по структуре
            if (stelaMeshNodes.length === 0) {
                console.log('Меши стелы не найдены по имени, определяем по структуре...');
                // Находим все ноды с мешами
                const meshedNodes = nodes.filter(node => node.getMesh());
                if (meshedNodes.length > 0) {
                    // Если есть хотя бы одна нода с мешом, считаем её стелой
                    stelaMeshNodes.push(meshedNodes[0]);
                    console.log(`Определен меш стелы (первый): ${meshedNodes[0].getName()}`);
                    // Если есть более одной ноды, ищем подставку
                    if (standMeshNode === null && meshedNodes.length > 1 && standSize) {
                        standMeshNode = meshedNodes[1];
                        console.log(`Определен меш подставки (второй): ${meshedNodes[1].getName()}`);
                    }
                }
            }
            // Вычисляем общий размер стелы
            // Этот шаг аналогичен созданию tempGroup в Angular виджете
            if (stelaMeshNodes.length > 0) {
                let minX = Infinity, minY = Infinity, minZ = Infinity;
                let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
                // Находим общий бокс для всех мешей стелы
                for (const node of stelaMeshNodes) {
                    const data = originalData.get(node);
                    if (data) {
                        const size = data.originalSize;
                        // Учитываем размеры
                        minX = Math.min(minX, -size.width / 2);
                        minY = Math.min(minY, -size.height / 2);
                        minZ = Math.min(minZ, -size.depth / 2);
                        maxX = Math.max(maxX, size.width / 2);
                        maxY = Math.max(maxY, size.height / 2);
                        maxZ = Math.max(maxZ, size.depth / 2);
                    }
                }
                const originalSize = {
                    height: maxY - minY,
                    width: maxX - minX,
                    depth: maxZ - minZ
                };
                console.log('Общий размер стелы:', originalSize);
                // Вычисляем коэффициенты масштабирования (точно как в Angular)
                const scaleFactors = {
                    height: stelaSize.height / (originalSize.height * 100),
                    width: stelaSize.width / (originalSize.width * 100),
                    depth: stelaSize.depth / (originalSize.depth * 100)
                };
                console.log('Коэффициенты масштабирования стелы:', scaleFactors);
                // Применяем масштабирование ко всем мешам стелы
                for (const node of stelaMeshNodes) {
                    const data = originalData.get(node);
                    if (data) {
                        // Сначала восстанавливаем исходную позицию
                        node.setTranslation(data.originalTranslation);
                        // Применяем масштаб
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
            // Масштабируем подставку, если она есть и нужна
            if (standMeshNode && standSize) {
                const data = originalData.get(standMeshNode);
                if (data) {
                    // Сначала восстанавливаем исходную позицию
                    standMeshNode.setTranslation(data.originalTranslation);
                    // Вычисляем коэффициенты масштабирования для подставки
                    const scaleFactors = {
                        height: standSize.height / (data.originalSize.height * 100),
                        width: standSize.width / (data.originalSize.width * 100),
                        depth: standSize.depth / (data.originalSize.depth * 100)
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
            else if (standMeshNode && !standSize) {
                // Если подставка есть, но не нужна, делаем её невидимой
                standMeshNode.setScale([0, 0, 0]);
                console.log('Подставка скрыта');
            }
            // Корректируем положение стелы относительно подставки
            if (stelaMeshNodes.length > 0) {
                // Создаем виртуальную группу для стелы, чтобы вычислить её bbox
                let stelaMinY = Infinity;
                // Находим минимальную Y-координату стелы после масштабирования
                for (const node of stelaMeshNodes) {
                    const data = originalData.get(node);
                    if (data) {
                        const t = node.getTranslation();
                        const s = node.getScale();
                        stelaMinY = Math.min(stelaMinY, t[1] - (data.originalSize.height * s[1] / 2));
                    }
                }
                if (standMeshNode && standSize) {
                    // Находим максимальную Y-координату подставки
                    const standData = originalData.get(standMeshNode);
                    let standMaxY = 0;
                    if (standData) {
                        const t = standMeshNode.getTranslation();
                        const s = standMeshNode.getScale();
                        standMaxY = t[1] + (standData.originalSize.height * s[1] / 2);
                    }
                    // Вычисляем необходимое смещение (как в Angular)
                    const offsetY = standMaxY - stelaMinY;
                    console.log(`Требуемое смещение по Y (с подставкой): ${offsetY}`);
                    // Применяем смещение ко всем мешам стелы
                    for (const node of stelaMeshNodes) {
                        const t = node.getTranslation();
                        node.setTranslation([t[0], t[1] + offsetY, t[2]]);
                    }
                }
                else {
                    // Если подставки нет, размещаем стелу на уровне Y=0
                    const offsetY = -stelaMinY;
                    console.log(`Требуемое смещение по Y (без подставки): ${offsetY}`);
                    // Применяем смещение ко всем мешам стелы
                    for (const node of stelaMeshNodes) {
                        const t = node.getTranslation();
                        node.setTranslation([t[0], t[1] + offsetY, t[2]]);
                    }
                }
            }
            // Сохраняем модель
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
