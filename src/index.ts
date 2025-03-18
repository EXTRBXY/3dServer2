import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { container } from 'tsyringe';
import fs from 'fs';

import { SceneService } from './services/scene.service';
import { LoadService } from './services/load.service';
import { MaterialService } from './services/material.service';
import { TextureService } from './services/texture.service';
import { TransformService } from './services/transform.service';
import { UsdzService } from './services/usdz.service';

// Регистрация сервисов
container.register(TextureService, { useClass: TextureService });
container.register(MaterialService, { useClass: MaterialService });
container.register(LoadService, { useClass: LoadService });
container.register(SceneService, { useClass: SceneService });
container.register(TransformService, { useClass: TransformService });
container.register(UsdzService, { useClass: UsdzService });

const sceneService = container.resolve(SceneService);
const transformService = container.resolve(TransformService);
const usdzService = container.resolve(UsdzService);

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(cors());

// Создаем директории для файлов
const publicDir = path.join(process.cwd(), 'public');
const modelsDir = path.join(publicDir, '3dpreview', 'models');
const texturesDir = path.join(publicDir, '3dpreview', 'textures');
const outputDir = path.join(publicDir, 'WebAR');
const glbDir = path.join(outputDir, 'glb');
const usdzDir = path.join(outputDir, 'usdz');

// Создаем необходимые директории
try {
  [publicDir, modelsDir, texturesDir, outputDir, glbDir, usdzDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Создана директория: ${dir}`);
    }
  });
} catch (error) {
  console.error('Ошибка при создании директорий:', error);
}

interface ProcessModelRequest {
  modelId: string;
  stelaSize: { height: number; width: number; depth: number };
  standSize: { height: number; width: number; depth: number } | null;
  materialName: string;
}

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.post('/process-model', async (req, res) => {
  try {
    console.log('Получен запрос на обработку модели');
    const { modelId, stelaSize, standSize, materialName }: ProcessModelRequest = req.body;
    
    console.log('Параметры запроса:');
    console.log('- modelId:', modelId);
    console.log('- stelaSize:', stelaSize);
    console.log('- standSize:', standSize);
    console.log('- materialName:', materialName);

    // Использование нового сервиса трансформации
    try {
      // Трансформация и сохранение модели в GLB
      const glbPath = await transformService.transformModel(
        modelId,
        stelaSize,
        standSize,
        materialName
      );
      
      // Полный путь к GLB файлу для дальнейшей конвертации
      const fullGlbPath = path.join(process.cwd(), 'public', glbPath);
      
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
    } catch (error) {
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
      const glbFilePath = path.join(glbDir, `${filePrefix}.glb`);
      fs.writeFileSync(glbFilePath, Buffer.from(glbData));
      
      // Пытаемся создать USDZ (может не сработать, если инструменты не установлены)
      let usdzPath = `/WebAR/usdz/${filePrefix}.usdz`;
      try {
        usdzPath = await usdzService.convertGlbToUsdz(glbFilePath);
      } catch (usdzError) {
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
  } catch (error) {
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