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
exports.UsdzService = void 0;
const tsyringe_1 = require("tsyringe");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execPromise = util_1.default.promisify(child_process_1.exec);
let UsdzService = class UsdzService {
    constructor() {
        this.outputPath = path_1.default.join(process.cwd(), 'public', 'WebAR');
    }
    /**
     * Конвертирует GLB файл в USDZ формат
     * @param glbPath Путь к GLB файлу
     * @returns Путь к сгенерированному USDZ файлу
     */
    async convertGlbToUsdz(glbPath) {
        try {
            console.log(`Конвертация GLB в USDZ: ${glbPath}`);
            // Проверка наличия исходного файла
            if (!fs_1.default.existsSync(glbPath)) {
                throw new Error(`Исходный GLB файл не найден: ${glbPath}`);
            }
            // Создание пути для выходного файла
            const glbFileName = path_1.default.basename(glbPath);
            const usdzFileName = glbFileName.replace('.glb', '.usdz');
            const usdzPath = path_1.default.join(this.outputPath, 'usdz', usdzFileName);
            // Убедимся, что директория для USDZ существует
            const usdzDir = path_1.default.dirname(usdzPath);
            if (!fs_1.default.existsSync(usdzDir)) {
                fs_1.default.mkdirSync(usdzDir, { recursive: true });
            }
            // Формируем команду для конвертации
            await this.executeConversion(glbPath, usdzPath);
            // Проверяем, что файл был создан
            if (!fs_1.default.existsSync(usdzPath)) {
                throw new Error(`Не удалось создать USDZ файл: ${usdzPath}`);
            }
            console.log(`USDZ файл успешно создан: ${usdzPath}`);
            return `/WebAR/usdz/${usdzFileName}`;
        }
        catch (error) {
            console.error('Ошибка при конвертации GLB в USDZ:', error);
            throw error;
        }
    }
    /**
     * Выполняет команду для конвертации GLB в USDZ
     * Метод выбирает наиболее подходящий инструмент для конвертации
     */
    async executeConversion(glbPath, usdzPath) {
        try {
            // Попытка использовать usd_from_gltf (Google), если доступен
            try {
                const cmd = `usd_from_gltf "${glbPath}" "${usdzPath}"`;
                console.log(`Выполнение команды: ${cmd}`);
                await execPromise(cmd);
                return;
            }
            catch (error) {
                console.log('usd_from_gltf не доступен, пробуем альтернативный метод...');
            }
            // Альтернативный способ через gltf2usdz, если установлен
            try {
                const cmd = `gltf2usdz "${glbPath}" "${usdzPath}"`;
                console.log(`Выполнение команды: ${cmd}`);
                await execPromise(cmd);
                return;
            }
            catch (error) {
                console.log('gltf2usdz не доступен, пробуем последний метод...');
            }
            // Если предыдущие методы не сработали, выбрасываем ошибку
            throw new Error('Не найдены инструменты для конвертации GLB в USDZ. Установите usd_from_gltf или gltf2usdz.');
        }
        catch (error) {
            console.error('Ошибка при выполнении конвертации:', error);
            throw error;
        }
    }
};
exports.UsdzService = UsdzService;
exports.UsdzService = UsdzService = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [])
], UsdzService);
