import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { container } from 'tsyringe';
import fs from 'fs';
import bodyParser from 'body-parser';
import multer from 'multer';
import { networkInterfaces } from 'os';

import { SceneService } from './services/scene.service';
import { LoadService } from './services/load.service';
import { MaterialService } from './services/material.service';
import { TextureService } from './services/texture.service';
import { TransformService } from './services/transform.service';
import { USDZService } from './services/usdz.service';

// Регистрация сервисов
container.register(TextureService, { useClass: TextureService });
container.register(MaterialService, { useClass: MaterialService });
container.register(LoadService, { useClass: LoadService });
container.register(SceneService, { useClass: SceneService });
container.register(TransformService, { useClass: TransformService });
container.register(USDZService, { useClass: USDZService });

const transformService = container.resolve(TransformService);
const usdzService = container.resolve(USDZService);

// Создание приложения
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Создаем директории для файлов
const publicDir = path.join(process.cwd(), 'public');
const modelsDir = path.join(publicDir, '3dpreview', 'models');
const outputDir = path.join(publicDir, 'WebAR');
const glbDir = path.join(outputDir, 'glb');
const usdzDir = path.join(outputDir, 'usdz');

// Создаем необходимые директории
[publicDir, modelsDir, outputDir, glbDir, usdzDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Создана директория: ${dir}`);
  }
});

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, modelsDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// Статические файлы
app.use(express.static(publicDir));

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
      fileNameWithoutExt = path.basename(file.originalname, path.extname(file.originalname));
      actualFileName = file.originalname;
      console.log(`Файл загружен: ${actualFileName}`);
    } else if (modelId) {
      // Если передан modelId без файла, проверяем наличие файла в директории
      fileNameWithoutExt = modelId;
      
      // Проверяем, есть ли такой файл в директории, независимо от регистра и кодировки
      const files = fs.readdirSync(modelsDir);
      console.log(`Файлы в директории: ${files.join(', ')}`);
      
      // Ищем файл по имени без учета регистра
      const matchingFile = files.find(file => 
        path.basename(file, path.extname(file)).toLowerCase() === modelId.toLowerCase()
      );
      
      if (matchingFile) {
        actualFileName = matchingFile;
        fileNameWithoutExt = path.basename(matchingFile, path.extname(matchingFile));
        console.log(`Найден соответствующий файл: ${matchingFile}`);
      } else {
        console.error(`Файл модели не найден с ID: ${modelId}`);
        return res.status(400).json({ error: 'Файл модели не найден в директории' });
      }
      
      console.log(`Используется существующий файл: ${actualFileName}`);
    } else {
      return res.status(400).json({ error: 'Файл не загружен и не указан modelId' });
    }

    console.log('Параметры запроса:');
    console.log(`- Модель: ${fileNameWithoutExt}`);
    console.log(`- Размеры стелы: ${stelaWidth}x${stelaHeight}x${stelaDepth}`);
    console.log(`- Размеры подставки: ${standWidth || 'нет'}x${standHeight || 'нет'}x${standDepth || 'нет'}`);
    console.log(`- Материал: ${materialName}`);

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
    const glbPath = await transformService.transformModel(
      fileNameWithoutExt,
      stelaSize,
      standSize,
      materialName || 'standard',
      actualFileName
    );

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
  } catch (error) {
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
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`WebAR URL: http://localhost:${PORT}/WebAR`);
  // Выводим все доступные IP адреса
  const nets = networkInterfaces();
  console.log('\nДоступные адреса для подключения:');
  if (nets) {
    for (const name of Object.keys(nets)) {
      const interfaces = nets[name];
      if (interfaces) {
        for (const net of interfaces) {
          // Пропускаем non-IPv4 и internal адреса
          if (net.family === 'IPv4' && !net.internal) {
            console.log(`http://${net.address}:${PORT}`);
          }
        }
      }
    }
  }
}); 