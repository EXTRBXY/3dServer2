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
const body_parser_1 = __importDefault(require("body-parser"));
const multer_1 = __importDefault(require("multer"));
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
tsyringe_1.container.register(usdz_service_1.USDZService, { useClass: usdz_service_1.USDZService });
const transformService = tsyringe_1.container.resolve(transform_service_1.TransformService);
const usdzService = tsyringe_1.container.resolve(usdz_service_1.USDZService);
// Создание приложения
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
// Создаем директории для файлов
const publicDir = path_1.default.join(process.cwd(), 'public');
const modelsDir = path_1.default.join(publicDir, '3dpreview', 'models');
const outputDir = path_1.default.join(publicDir, 'WebAR');
const glbDir = path_1.default.join(outputDir, 'glb');
const usdzDir = path_1.default.join(outputDir, 'usdz');
// Создаем необходимые директории
[publicDir, modelsDir, outputDir, glbDir, usdzDir].forEach(dir => {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
        console.log(`Создана директория: ${dir}`);
    }
});
// Настройка multer для загрузки файлов
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, modelsDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = (0, multer_1.default)({ storage });
// Статические файлы
app.use(express_1.default.static(publicDir));
// Обработка модели
app.post('/process-model', upload.single('model'), async (req, res) => {
    try {
        console.log('Получен запрос на обработку модели');
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Тело запроса:', req.body);
        // Получаем параметры из запроса (поддержка как multipart/form-data, так и application/json)
        const body = req.is('application/json') ? req.body : req.body;
        const { stelaWidth, stelaHeight, stelaDepth, standWidth, standHeight, standDepth, materialName, modelId } = body;
        // Проверяем обязательные параметры
        if (!stelaWidth || !stelaHeight || !stelaDepth) {
            return res.status(400).json({ error: 'Не указаны обязательные параметры размера стелы' });
        }
        // Проверяем наличие файла или modelId
        const file = req.file;
        let fileNameWithoutExt;
        let actualFileName = null;
        if (file) {
            // Если файл был загружен через форму
            fileNameWithoutExt = path_1.default.basename(file.originalname, path_1.default.extname(file.originalname));
            actualFileName = file.originalname;
            console.log(`Файл загружен: ${actualFileName}`);
        }
        else if (modelId) {
            // Если передан modelId без файла, проверяем наличие файла в директории
            fileNameWithoutExt = modelId;
            // Проверяем, есть ли такой файл в директории, независимо от регистра и кодировки
            const files = fs_1.default.readdirSync(modelsDir);
            console.log(`Файлы в директории: ${files.join(', ')}`);
            // Ищем файл по имени без учета регистра
            const matchingFile = files.find(file => path_1.default.basename(file, path_1.default.extname(file)).toLowerCase() === modelId.toLowerCase());
            if (matchingFile) {
                actualFileName = matchingFile;
                fileNameWithoutExt = path_1.default.basename(matchingFile, path_1.default.extname(matchingFile));
                console.log(`Найден соответствующий файл: ${matchingFile}`);
            }
            else {
                console.error(`Файл модели не найден с ID: ${modelId}`);
                return res.status(400).json({ error: 'Файл модели не найден в директории' });
            }
            console.log(`Используется существующий файл: ${actualFileName}`);
        }
        else {
            return res.status(400).json({ error: 'Файл не загружен и не указан modelId' });
        }
        console.log('Параметры запроса:');
        console.log(`- Модель: ${fileNameWithoutExt}`);
        console.log(`- Размеры стелы: ${stelaWidth}x${stelaHeight}x${stelaDepth}`);
        console.log(`- Размеры подставки: ${standWidth || 'нет'}x${standHeight || 'нет'}x${standDepth || 'нет'}`);
        // Формируем объект с размерами стелы
        const stelaSize = {
            width: parseFloat(stelaWidth),
            height: parseFloat(stelaHeight),
            depth: parseFloat(stelaDepth)
        };
        // Формируем объект с размерами подставки (если указаны)
        let standSize = null;
        if (standWidth && standHeight && standDepth) {
            standSize = {
                width: parseFloat(standWidth),
                height: parseFloat(standHeight),
                depth: parseFloat(standDepth)
            };
        }
        // Трансформация модели
        const glbPath = await transformService.transformModel(fileNameWithoutExt, stelaSize, standSize, materialName || 'standard', actualFileName);
        // Конвертация в USDZ
        const usdzPath = await usdzService.convertToUSDZ(glbPath);
        // Формирование полных URL
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const glbUrl = `${baseUrl}${glbPath}`;
        const usdzUrl = usdzPath ? `${baseUrl}${usdzPath}` : null;
        // Отправка результата
        res.json({
            success: true,
            glbUrl,
            usdzUrl,
            modelId: fileNameWithoutExt
        });
    }
    catch (error) {
        console.error('Ошибка при обработке модели:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при обработке модели',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
// Статус сервера
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});
// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`WebAR URL: http://localhost:${PORT}/WebAR`);
});
