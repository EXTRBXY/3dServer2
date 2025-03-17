import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { container } from 'tsyringe';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';

import { SceneService } from './services/scene.service';
import { LoadService } from './services/load.service';
import { MaterialService } from './services/material.service';
import { TextureService } from './services/texture.service';

// Регистрация сервисов
container.register(TextureService, { useClass: TextureService });
container.register(MaterialService, { useClass: MaterialService });
container.register(LoadService, { useClass: LoadService });
container.register(SceneService, { useClass: SceneService });

const sceneService = container.resolve(SceneService);

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

    // Инициализация модели
    await sceneService.initModel(modelId);

    // Применение размеров и материалов
    sceneService.stelaSize = stelaSize;
    sceneService.standSize = standSize;
    await sceneService.changeMaterial(materialName);

    // Экспорт в GLB
    const gltfExporter = new GLTFExporter();
    const glbData = await new Promise<ArrayBuffer>((resolve, reject) => {
      try {
        console.log('Начало экспорта GLB');
        gltfExporter.parse(
          sceneService.getScene(), 
          (result) => {
            console.log('GLB экспорт успешно завершен');
            resolve(result as ArrayBuffer);
          },
          (error) => {
            console.error('Ошибка при экспорте GLB:', error);
            reject(error);
          },
          { binary: true }
        );
      } catch (error) {
        console.error('Ошибка при вызове GLTFExporter.parse:', error);
        reject(error);
      }
    });

    // Сохранение файлов
    const timestamp = Date.now();
    const filePrefix = `${modelId}_${timestamp}`;
    const glbFilePath = path.join(glbDir, `${filePrefix}.glb`);
    
    console.log(`Сохранение GLB файла: ${glbFilePath}`);
    fs.writeFileSync(glbFilePath, Buffer.from(glbData));
    
    res.json({
      success: true,
      message: 'Модель успешно обработана',
      files: {
        glb: `/WebAR/glb/${filePrefix}.glb`,
        usdz: `/WebAR/usdz/${filePrefix}.usdz` // Заглушка для USDZ
      }
    });
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