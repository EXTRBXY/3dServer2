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
const functions_1 = require("@gltf-transform/functions");
const three_1 = require("three");
let TransformService = class TransformService {
    constructor() {
        this.modelsPath = path_1.default.join(process.cwd(), 'public', '3dpreview', 'models');
        this.outputPath = path_1.default.join(process.cwd(), 'public', 'WebAR');
    }
    /**
     * Трансформирует модель, применяя изменения размеров стелы и подставки
     */
    async transformModel(modelId, stelaSize, standSize, materialName) {
        const inputPath = path_1.default.join(this.modelsPath, `${modelId}.glb`);
        const timestamp = Date.now();
        const outputFileName = `${modelId}_${timestamp}.glb`;
        const outputPath = path_1.default.join(this.outputPath, 'glb', outputFileName);
        try {
            console.log(`Трансформация модели ${modelId} с использованием gltf-transform`);
            console.log(`- Размер стелы: ${JSON.stringify(stelaSize)}`);
            console.log(`- Размер подставки: ${standSize ? JSON.stringify(standSize) : 'нет'}`);
            // Проверяем наличие входного файла
            if (!fs_1.default.existsSync(inputPath)) {
                throw new Error(`Файл модели не найден: ${inputPath}`);
            }
            // Настройка I/O
            const io = new core_1.NodeIO().registerExtensions(extensions_1.ALL_EXTENSIONS);
            // Чтение документа
            const document = await io.read(inputPath);
            // Применение трансформаций
            await this.applyTransformations(document, stelaSize, standSize);
            // Оптимизация модели
            await document.transform((0, functions_1.prune)(), (0, functions_1.dedup)(), (0, functions_1.weld)());
            // Сохранение результата
            await io.write(outputPath, document);
            console.log(`Модель успешно трансформирована и сохранена: ${outputPath}`);
            return `/WebAR/glb/${outputFileName}`;
        }
        catch (error) {
            console.error('Ошибка при трансформации модели:', error);
            throw error;
        }
    }
    /**
     * Применяет трансформации к модели в соответствии с заданными параметрами
     */
    async applyTransformations(document, stelaSize, standSize) {
        const root = document.getRoot();
        const meshes = root.listMeshes();
        // Обход всех мешей в документе
        for (const mesh of meshes) {
            const meshName = mesh.getName().toLowerCase();
            // Определяем, является ли меш стелой или подставкой
            if (meshName.includes('node_stand')) {
                if (standSize) {
                    await this.transformStand(mesh, standSize);
                }
                else {
                    // Скрыть подставку, если размер не указан
                    await this.hideMesh(document, mesh);
                }
            }
            else if (meshName.includes('node') || meshName.includes('other')) {
                await this.transformStela(mesh, stelaSize);
            }
        }
        // Соединяем все меши в правильных позициях
        await this.alignMeshes(document, standSize !== null);
    }
    /**
     * Трансформирует меш стелы, применяя нужные размеры
     */
    async transformStela(mesh, size) {
        console.log(`Трансформация стелы: ${mesh.getName()}`);
        // Получаем оригинальные размеры
        const originalSize = await this.getMeshSize(mesh);
        // Вычисляем масштабные факторы (от сантиметров к метрам)
        const scaleFactors = {
            width: size.width / (originalSize.width * 100),
            height: size.height / (originalSize.height * 100),
            depth: size.depth / (originalSize.depth * 100)
        };
        console.log(`Исходный размер стелы: ${JSON.stringify(originalSize)}`);
        console.log(`Коэффициенты масштабирования: ${JSON.stringify(scaleFactors)}`);
        // Создаем матрицу масштабирования
        const scaleMatrix = new three_1.Matrix4().makeScale(scaleFactors.width, scaleFactors.height, scaleFactors.depth);
        // Применяем трансформацию к каждому примитиву меша
        for (const primitive of mesh.listPrimitives()) {
            const position = primitive.getAttribute('POSITION');
            if (!position)
                continue;
            const array = position.getArray();
            if (!array)
                continue;
            // Создаем новый массив для трансформированных координат
            const newArray = new Float32Array(array.length);
            // Применяем масштабирование к каждой вершине
            for (let i = 0; i < array.length; i += 3) {
                const x = array[i] * scaleFactors.width;
                const y = array[i + 1] * scaleFactors.height;
                const z = array[i + 2] * scaleFactors.depth;
                newArray[i] = x;
                newArray[i + 1] = y;
                newArray[i + 2] = z;
            }
            // Обновляем атрибут позиции
            position.setArray(newArray);
        }
    }
    /**
     * Трансформирует меш подставки, применяя нужные размеры
     */
    async transformStand(mesh, size) {
        console.log(`Трансформация подставки: ${mesh.getName()}`);
        // Получаем оригинальные размеры
        const originalSize = await this.getMeshSize(mesh);
        // Вычисляем масштабные факторы (от сантиметров к метрам)
        const scaleFactors = {
            width: size.width / (originalSize.width * 100),
            height: size.height / (originalSize.height * 100),
            depth: size.depth / (originalSize.depth * 100)
        };
        console.log(`Исходный размер подставки: ${JSON.stringify(originalSize)}`);
        console.log(`Коэффициенты масштабирования: ${JSON.stringify(scaleFactors)}`);
        // Создаем матрицу масштабирования
        const scaleMatrix = new three_1.Matrix4().makeScale(scaleFactors.width, scaleFactors.height, scaleFactors.depth);
        // Применяем трансформацию к каждому примитиву меша
        for (const primitive of mesh.listPrimitives()) {
            const position = primitive.getAttribute('POSITION');
            if (!position)
                continue;
            const array = position.getArray();
            if (!array)
                continue;
            // Создаем новый массив для трансформированных координат
            const newArray = new Float32Array(array.length);
            // Применяем масштабирование к каждой вершине
            for (let i = 0; i < array.length; i += 3) {
                const x = array[i] * scaleFactors.width;
                const y = array[i + 1] * scaleFactors.height;
                const z = array[i + 2] * scaleFactors.depth;
                newArray[i] = x;
                newArray[i + 1] = y;
                newArray[i + 2] = z;
            }
            // Обновляем атрибут позиции
            position.setArray(newArray);
        }
    }
    /**
     * Скрывает меш, удаляя его из всех использующих его нод
     */
    async hideMesh(document, mesh) {
        const nodes = document.getRoot().listNodes();
        for (const node of nodes) {
            if (node.getMesh() === mesh) {
                node.setMesh(null);
            }
        }
    }
    /**
     * Выравнивает стелу относительно подставки (если есть)
     */
    async alignMeshes(document, hasStand) {
        console.log(`Выравнивание мешей, наличие подставки: ${hasStand}`);
        // Если нет подставки, возвращаем стелу на базовую позицию
        if (!hasStand) {
            return;
        }
        // Ищем меши стелы и подставки
        const root = document.getRoot();
        let stelaMesh = null;
        let standMesh = null;
        // Находим меши по имени
        for (const mesh of root.listMeshes()) {
            const meshName = mesh.getName().toLowerCase();
            if (meshName.includes('node_stand')) {
                standMesh = mesh;
            }
            else if (meshName.includes('node') || meshName.includes('other')) {
                stelaMesh = mesh;
            }
        }
        // Если не нашли оба меша, выходим
        if (!stelaMesh || !standMesh) {
            console.log('Не найдены меши для выравнивания');
            return;
        }
        // Находим ноды, которые используют эти меши
        const nodes = root.listNodes();
        let stelaNode = null;
        let standNode = null;
        for (const node of nodes) {
            if (node.getMesh() === stelaMesh) {
                stelaNode = node;
            }
            else if (node.getMesh() === standMesh) {
                standNode = node;
            }
        }
        // Если не нашли обе ноды, выходим
        if (!stelaNode || !standNode) {
            console.log('Не найдены ноды для выравнивания');
            return;
        }
        // Определяем размеры мешей
        const stelaSize = await this.getMeshSize(stelaMesh);
        const standSize = await this.getMeshSize(standMesh);
        // Получаем текущие трансформации
        const stelaTranslation = stelaNode.getTranslation();
        // Устанавливаем позицию стелы над подставкой
        stelaTranslation[1] = standSize.height; // Y-координата
        stelaNode.setTranslation(stelaTranslation);
        console.log('Выравнивание выполнено');
    }
    /**
     * Получает размеры меша
     */
    async getMeshSize(mesh) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        // Обход всех примитивов в меше
        for (const primitive of mesh.listPrimitives()) {
            const position = primitive.getAttribute('POSITION');
            if (!position)
                continue;
            const array = position.getArray();
            if (!array)
                continue;
            // Анализ всех вершин для определения границ
            for (let i = 0; i < array.length; i += 3) {
                const x = array[i];
                const y = array[i + 1];
                const z = array[i + 2];
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                minZ = Math.min(minZ, z);
                maxZ = Math.max(maxZ, z);
            }
        }
        return {
            width: maxX - minX,
            height: maxY - minY,
            depth: maxZ - minZ
        };
    }
};
exports.TransformService = TransformService;
exports.TransformService = TransformService = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [])
], TransformService);
