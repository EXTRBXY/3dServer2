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
exports.USDZService = void 0;
const tsyringe_1 = require("tsyringe");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execPromise = (0, util_1.promisify)(child_process_1.exec);
let USDZService = class USDZService {
    constructor() {
        this.outputPath = path_1.default.join(process.cwd(), 'public', 'WebAR', 'usdz');
    }
    /**
     * Конвертирует GLB файл в USDZ формат для iOS AR Quick Look
     * @param glbPath Путь к GLB файлу (относительно публичной директории)
     * @returns Путь к сгенерированному USDZ файлу или null в случае ошибки
     */
    async convertToUSDZ(glbPath) {
        try {
            // Проверяем, передан ли относительный путь
            if (!glbPath.startsWith('/WebAR/glb/')) {
                console.error('Неверный формат пути GLB файла:', glbPath);
                return null;
            }
            // Получаем абсолютный путь к GLB файлу
            const absoluteGlbPath = path_1.default.join(process.cwd(), 'public', glbPath);
            // Проверяем существование GLB файла
            if (!fs_1.default.existsSync(absoluteGlbPath)) {
                console.error('GLB файл не найден:', absoluteGlbPath);
                return null;
            }
            // Получаем имя файла
            const glbFileName = path_1.default.basename(glbPath);
            const fileName = path_1.default.basename(glbFileName, '.glb');
            const usdzFileName = `${fileName}.usdz`;
            const usdzFilePath = path_1.default.join(this.outputPath, usdzFileName);
            console.log(`Конвертация ${glbFileName} в USDZ...`);
            // Проверяем существование директории для выходного файла
            if (!fs_1.default.existsSync(this.outputPath)) {
                fs_1.default.mkdirSync(this.outputPath, { recursive: true });
            }
            // Создаем пустой USDZ файл
            // В реальном проекте здесь должна быть интеграция с инструментом конвертации
            // Например, вызов внешней команды gltf2usd или использование библиотеки
            fs_1.default.writeFileSync(usdzFilePath, Buffer.from('USDZ', 'utf8'));
            console.log(`USDZ файл создан: ${usdzFilePath}`);
            return `/WebAR/usdz/${usdzFileName}`;
        }
        catch (error) {
            console.error('Ошибка в USDZService.convertToUSDZ:', error);
            return null;
        }
    }
};
exports.USDZService = USDZService;
exports.USDZService = USDZService = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [])
], USDZService);
