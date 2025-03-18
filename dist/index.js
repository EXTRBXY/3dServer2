"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const tsyringe_1 = require("tsyringe");
const fs_1 = __importDefault(require("fs"));
const scene_service_1 = require("./services/scene.service");
const load_service_1 = require("./services/load.service");
const material_service_1 = require("./services/material.service");
const texture_service_1 = require("./services/texture.service");
const transform_service_1 = require("./services/transform.service");
const usdz_service_1 = require("./services/usdz.service");
// Регистрация сервисов
tsyringe_1.container.register(texture_service_1.TextureService, { useClass: texture_service_1.TextureService });
tsyringe_1.container.register(material_service_1.MaterialService, { useClass: material_service_1.MaterialService });
tsyringe_1.container.register(load_service_1.LoadService, { useClass: load_service_1.LoadService });
tsyringe_1.container.register(scene_service_1.SceneService, { useClass: scene_service_1.SceneService });
tsyringe_1.container.register(transform_service_1.TransformService, { useClass: transform_service_1.TransformService });
tsyringe_1.container.register(usdz_service_1.UsdzService, { useClass: usdz_service_1.UsdzService });
const sceneService = tsyringe_1.container.resolve(scene_service_1.SceneService);
const transformService = tsyringe_1.container.resolve(transform_service_1.TransformService);
const usdzService = tsyringe_1.container.resolve(usdz_service_1.UsdzService);
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.static('public'));
app.use((0, cors_1.default)());
// Создаем директории для файлов
const publicDir = path_1.default.join(process.cwd(), 'public');
const modelsDir = path_1.default.join(publicDir, '3dpreview', 'models');
const texturesDir = path_1.default.join(publicDir, '3dpreview', 'textures');
const outputDir = path_1.default.join(publicDir, 'WebAR');
const glbDir = path_1.default.join(outputDir, 'glb');
const usdzDir = path_1.default.join(outputDir, 'usdz');
// Создаем необходимые директории
try {
    [publicDir, modelsDir, texturesDir, outputDir, glbDir, usdzDir].forEach(dir => {
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
            console.log(`Создана директория: ${dir}`);
        }
    });
}
catch (error) {
    console.error('Ошибка при создании директорий:', error);
}
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(publicDir, 'index.html'));
});
app.post('/process-model', async (req, res) => {
    try {
        console.log('Получен запрос на обработку модели');
        const { modelId, stelaSize, standSize, materialName } = req.body;
        console.log('Параметры запроса:');
        console.log('- modelId:', modelId);
        console.log('- stelaSize:', stelaSize);
        console.log('- standSize:', standSize);
        console.log('- materialName:', materialName);
        // Использование нового сервиса трансформации
        try {
            // Трансформация и сохранение модели в GLB
            const glbPath = await transformService.transformModel(modelId, stelaSize, standSize, materialName);
            // Полный путь к GLB файлу для дальнейшей конвертации
            const fullGlbPath = path_1.default.join(process.cwd(), 'public', glbPath);
            // Конвертация в USDZ для Apple QuickLook
            const usdzPath = await usdzService.convertGlbToUsdz(fullGlbPath);
            res.json({
                success: true,
                message: 'Модель успешно обработана',
                files: {
                    glb: glbPath,
                    usdz: usdzPath
                }
            });
        }
        catch (error) {
            // Резервный вариант с использованием старого метода
            console.warn('Ошибка при использовании нового метода трансформации. Использую резервный метод:', error);
            // Инициализация модели
            await sceneService.initModel(modelId);
            // Применение размеров и материалов
            sceneService.stelaSize = stelaSize;
            sceneService.standSize = standSize;
            await sceneService.changeMaterial(materialName);
            // Экспорт и сохранение с использованием Three.js GLTFExporter
            const timestamp = Date.now();
            const filePrefix = `${modelId}_${timestamp}`;
            // Экспорт сцены в GLB
            const glbData = await sceneService.exportToGLB();
            // Сохранение GLB файла
            const glbFilePath = path_1.default.join(glbDir, `${filePrefix}.glb`);
            fs_1.default.writeFileSync(glbFilePath, Buffer.from(glbData));
            // Пытаемся создать USDZ (может не сработать, если инструменты не установлены)
            let usdzPath = `/WebAR/usdz/${filePrefix}.usdz`;
            try {
                usdzPath = await usdzService.convertGlbToUsdz(glbFilePath);
            }
            catch (usdzError) {
                console.warn('Не удалось создать USDZ файл, возвращаем предполагаемый путь:', usdzError);
            }
            res.json({
                success: true,
                message: 'Модель успешно обработана (резервный метод)',
                files: {
                    glb: `/WebAR/glb/${filePrefix}.glb`,
                    usdz: usdzPath
                }
            });
        }
    }
    catch (error) {
        console.error('Ошибка при обработке модели:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Неизвестная ошибка'
        });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Веб-интерфейс доступен по адресу: http://localhost:${PORT}/`);
});
