export const CLASSES = {
  swordsman: {
    name: 'Мечник', title: 'Клятва Клинка', icon: '╱', image: 'assets/class-swordsman.webp',
    hp: 125, speed: 192, damage: 1.16, primary: 'blade', accent: '#e4b35f',
    passive: 'Получает на 12% меньше контактного урона.', ability: 'Круговой разрез отражает вражеские снаряды.'
  },
  archer: {
    name: 'Лучник', title: 'Глаз Пустоши', icon: '➶', image: 'assets/class-archer.webp',
    hp: 92, speed: 232, damage: 1.04, primary: 'bow', accent: '#ef9e55',
    passive: 'Каждое пятое попадание наносит критический урон.', ability: 'Выпускает веер из семи пробивающих стрел.'
  },
  mage: {
    name: 'Маг', title: 'Хранитель Формулы', icon: '✧', image: 'assets/class-mage.webp',
    hp: 82, speed: 204, damage: 1.12, primary: 'arcana', accent: '#b893ff',
    passive: 'Заклинания могут перескакивать между целями.', ability: 'Создаёт разлом, замедляющий и притягивающий врагов.'
  },
  mechanist: {
    name: 'Механист', title: 'Руки Архива', icon: '⚙', image: 'assets/class-mechanist.webp',
    hp: 105, speed: 200, damage: 1.02, primary: 'repeater', accent: '#68dcc4',
    passive: 'Боевой дрон самостоятельно выбирает цели.', ability: 'Перегружает устройства и вызывает второго дрона.'
  }
};

export const STAGES = [
  {
    id: 'outer-ring', number: 1, title: 'Внешнее кольцо', subtitle: 'ПЕРВЫЙ СИГНАЛ',
    lore: 'Камень здесь помнит шаги тех, кто исчез раньше тебя.', objective: 'survive', duration: 180,
    x: 9, y: 50, accent: '#65dfbe', biome: 'ruins', enemies: ['husk', 'wisp', 'charger'], boss: 'archon', requires: []
  },
  {
    id: 'machine-garden', number: 2, title: 'Машинный сад', subtitle: 'ЛОЖНАЯ ЖИЗНЬ',
    lore: 'Сад растёт без солнца. Его корни сделаны из проводов.', objective: 'seals', duration: 210,
    x: 29, y: 28, accent: '#5ad8b7', biome: 'garden', enemies: ['drone', 'wisp', 'hound'], boss: 'gardener', requires: ['outer-ring']
  },
  {
    id: 'bone-observatory', number: 3, title: 'Обсерватория', subtitle: 'НЕБО БЕЗ ЗВЁЗД',
    lore: 'Приборы всё ещё следят за тем, чего больше нет.', objective: 'hunt', duration: 210,
    x: 29, y: 72, accent: '#a993e8', biome: 'observatory', enemies: ['seer', 'husk', 'charger'], boss: 'oracle', requires: ['outer-ring']
  },
  {
    id: 'static-foundry', number: 4, title: 'Кузница помех', subtitle: 'ЗАЩИТИТЬ ИСКРУ',
    lore: 'Старая кузница снова горит. Не дай ей погаснуть.', objective: 'defense', duration: 240,
    x: 53, y: 28, accent: '#ed9b54', biome: 'foundry', enemies: ['brute', 'drone', 'sentinel'], boss: 'forgemaster', requires: ['machine-garden']
  },
  {
    id: 'silent-archive', number: 5, title: 'Безмолвный архив', subtitle: 'НАЙТИ ИМЕНА',
    lore: 'Книги закрыты. Их стражи — нет.', objective: 'hunt', duration: 270,
    x: 53, y: 72, accent: '#76b9e8', biome: 'archive', enemies: ['scribe', 'seer', 'hound'], boss: 'librarian', requires: ['bone-observatory']
  },
  {
    id: 'crown-heart', number: 6, title: 'Сердце Короны', subtitle: 'ПОСЛЕДНИЙ ПРОТОКОЛ',
    lore: 'Две дороги сходятся там, где механизм выбирает носителя.', objective: 'boss', duration: 360,
    x: 76, y: 50, accent: '#e2b05c', biome: 'crown', enemies: ['sentinel', 'scribe', 'brute', 'drone'], boss: 'crown', requiresAny: ['static-foundry', 'silent-archive']
  },
  { id: 'future-1', title: 'Неизвестный сектор', x: 93, y: 27, future: true },
  { id: 'future-2', title: 'Неизвестный сектор', x: 93, y: 50, future: true },
  { id: 'future-3', title: 'Неизвестный сектор', x: 93, y: 73, future: true }
];

export const UPGRADES = {
  blade: {
    name: 'Клинок Резонанса', icon: '╱', category: 'weapons', classes: ['swordsman'], max: 5, accent: '#e4b35f',
    descriptions: ['Широкий автоматический разрез по ближайшей цели.', 'Разрез становится шире и сильнее.', 'Второй быстрый удар после первого.', 'Клинок выпускает короткую волну.', 'Каждый третий удар становится круговым.']
  },
  bow: {
    name: 'Лук Золотой Нити', icon: '➶', category: 'weapons', classes: ['archer'], max: 5, accent: '#ef9e55',
    descriptions: ['Автоматически выпускает стрелу в ближайшую цель.', 'Стрелы пронзают ещё одну цель.', 'Выпускает две стрелы под небольшим углом.', 'Скорость и урон стрел значительно возрастают.', 'Третья стрела самостоятельно ищет цель.']
  },
  arcana: {
    name: 'Формула Разлома', icon: '✧', category: 'weapons', classes: ['mage'], max: 5, accent: '#b893ff',
    descriptions: ['Сфера преследует цель и перескакивает один раз.', 'Добавляет ещё один скачок.', 'Сфера оставляет ослабляющий след.', 'Запускает вторую сферу.', 'Последний скачок завершается вспышкой.']
  },
  repeater: {
    name: 'Реликтовый Повторитель', icon: '⌁', category: 'weapons', classes: ['mechanist'], max: 5, accent: '#68dcc4',
    descriptions: ['Быстро выпускает короткие энергетические иглы.', 'Иглы летят быстрее и пробивают цель.', 'Дрон копирует каждую четвёртую атаку.', 'Выпускает по две иглы.', 'Каждое попадание ускоряет следующую очередь.']
  },
  halo: {
    name: 'Латунный Нимб', icon: '◌', category: 'weapons', max: 5, accent: '#e2b05c',
    descriptions: ['Осколок вращается вокруг носителя.', 'Добавляет второй осколок.', 'Орбита расширяется и наносит больше урона.', 'Добавляет третий осколок.', 'Осколки замедляют врагов.']
  },
  thorns: {
    name: 'Шипы Эфира', icon: '✣', category: 'weapons', max: 5, accent: '#bb91ff',
    descriptions: ['Периодически поднимает кольцо шипов.', 'Сокращает паузу между кольцами.', 'Создаёт второе внешнее кольцо.', 'Увеличивает радиус и урон.', 'После волны остаётся короткий разлом.']
  },
  storm: {
    name: 'Катушка Бури', icon: 'ϟ', category: 'weapons', max: 5, accent: '#75dff2',
    descriptions: ['Молния регулярно поражает ближайшую цель.', 'Молния перескакивает ещё один раз.', 'Сокращает время перезарядки.', 'Добавляет вторую независимую молнию.', 'Последняя цель взрывается электрической дугой.']
  },
  mines: {
    name: 'Мины Смотрителя', icon: '⊙', category: 'weapons', max: 5, accent: '#f29a67',
    descriptions: ['Оставляет позади нестабильную мину.', 'Мина заряжается быстрее.', 'Радиус взрыва увеличивается.', 'Одновременно можно держать больше мин.', 'Взрыв выпускает три осколка.']
  },
  frost: {
    name: 'Холодный Маятник', icon: '❄', category: 'weapons', max: 4, accent: '#83bfea',
    descriptions: ['Периодически замедляет ближайших врагов.', 'Увеличивает радиус холода.', 'Замедленные цели получают больше урона.', 'Каждая волна создаёт ледяные осколки.']
  },
  cadence: {
    name: 'Нервный Генератор', icon: '≋', category: 'artifacts', max: 4, accent: '#66e3c4',
    descriptions: ['Скорость атак +12%.', 'Скорость атак ещё +12%.', 'Скорость атак ещё +12%.', 'Скорость атак ещё +16%.']
  },
  stride: {
    name: 'Сапоги Не Того Размера', icon: '≫', category: 'artifacts', max: 3, accent: '#e7d7a8',
    descriptions: ['Скорость движения +10%.', 'Скорость движения ещё +10%.', 'Рывок временно ускоряет героя.']
  },
  magnet: {
    name: 'Голодный Компас', icon: '⌖', category: 'artifacts', max: 3, accent: '#62b8ff',
    descriptions: ['Радиус сбора опыта +45%.', 'Радиус сбора ещё +45%.', 'Опыт иногда удваивается.']
  },
  vitality: {
    name: 'Запасное Сердце', icon: '◇', category: 'artifacts', max: 3, accent: '#ef7969',
    descriptions: ['Максимум здоровья +22 и лечение.', 'Максимум здоровья ещё +22.', 'Восстанавливает здоровье вне опасности.']
  },
  armor: {
    name: 'Панцирь Архива', icon: '⬡', category: 'artifacts', max: 3, accent: '#bdc9c2',
    descriptions: ['Получаемый урон -8%.', 'Получаемый урон ещё -8%.', 'После попадания защита длится дольше.']
  },
  recovery: {
    name: 'Нить Возврата', icon: '∞', category: 'artifacts', max: 3, accent: '#91d49c',
    descriptions: ['Каждые 18 секунд восстанавливает 4 здоровья.', 'Лечение увеличивается до 7.', 'Победа над элитой также лечит героя.']
  },
  fortune: {
    name: 'Кость Без Чисел', icon: '◆', category: 'artifacts', max: 3, accent: '#d6a7e9',
    descriptions: ['Шанс критического удара +6%.', 'Шанс критического удара ещё +6%.', 'Критические удары создают искру опыта.']
  }
};

export const FUSIONS = {
  bulwark: {
    name: 'Солнечный Бастион', icon: '✺', accent: '#f0bd63', recipe: ['blade', 'armor'], levels: [4, 3], classes: ['swordsman'],
    description: 'Разрез становится круговым, отражает снаряды и укрепляет владельца.'
  },
  deadeye: {
    name: 'Тысяча Нитей', icon: '⫷', accent: '#ff9e59', recipe: ['bow', 'cadence'], levels: [4, 3], classes: ['archer'],
    description: 'Стрелы разделяются после попадания и ищут новые цели.'
  },
  oracleStorm: {
    name: 'Грозовой Оракул', icon: '※', accent: '#bc91ff', recipe: ['arcana', 'storm'], levels: [4, 3], classes: ['mage'],
    description: 'Сферы соединяются молниями и завершают путь разломом.'
  },
  choir: {
    name: 'Автономный Хор', icon: '⌬', accent: '#6ae5c5', recipe: ['repeater', 'mines'], levels: [4, 3], classes: ['mechanist'],
    description: 'Три дрона превращают мины в автоматические турели.'
  },
  briarCrown: {
    name: 'Терновая Корона', icon: '❉', accent: '#d9ad75', recipe: ['halo', 'thorns'], levels: [4, 4],
    description: 'Осколки Нимба выпускают собственные кольца эфирных шипов.'
  }
};

export const ENEMIES = {
  husk: { name: 'Пустая оболочка', family: 'ЗАБЫТЫЕ', radius: 15, hp: 30, speed: 63, damage: 10, xp: 1, color: '#88a99c', shape: 'husk' },
  wisp: { name: 'Искра могилы', family: 'ЗАБЫТЫЕ', radius: 10, hp: 19, speed: 91, damage: 8, xp: 1, color: '#73dcbc', shape: 'wisp' },
  drone: { name: 'Слепой дрон', family: 'МЕХАНИЗМЫ', radius: 14, hp: 48, speed: 55, damage: 11, xp: 2, color: '#d6ac62', shape: 'drone', ranged: true },
  charger: { name: 'Рваный рыцарь', family: 'ЗАБЫТЫЕ', radius: 18, hp: 70, speed: 49, damage: 17, xp: 3, color: '#8fa3dc', shape: 'charger', charger: true },
  brute: { name: 'Каменный счетовод', family: 'СТРАЖИ', radius: 24, hp: 135, speed: 38, damage: 20, xp: 5, color: '#b87959', shape: 'brute' },
  seer: { name: 'Слепой астроном', family: 'НАБЛЮДАТЕЛИ', radius: 16, hp: 58, speed: 46, damage: 13, xp: 3, color: '#b792ee', shape: 'seer', ranged: true },
  hound: { name: 'Латунная гончая', family: 'МЕХАНИЗМЫ', radius: 13, hp: 42, speed: 108, damage: 12, xp: 2, color: '#df985a', shape: 'hound' },
  sentinel: { name: 'Страж кузницы', family: 'СТРАЖИ', radius: 20, hp: 105, speed: 43, damage: 18, xp: 4, color: '#e1804d', shape: 'sentinel', ranged: true },
  scribe: { name: 'Переписчик', family: 'АРХИВ', radius: 17, hp: 78, speed: 52, damage: 14, xp: 3, color: '#70b7df', shape: 'scribe', ranged: true }
};

export const BOSSES = {
  archon: { name: 'АРХОНТ НУЛЯ', subtitle: 'СТРАЖ ВНЕШНЕГО КРУГА', radius: 52, hp: 1300, speed: 34, damage: 26, color: '#d4a45c' },
  gardener: { name: 'САДОВНИК МЕДИ', subtitle: 'ТОТ, КТО ВЫРАЩИВАЕТ МАШИНЫ', radius: 56, hp: 1900, speed: 37, damage: 28, color: '#62d2a9' },
  oracle: { name: 'ОРБИТАЛЬНЫЙ ОРАКУЛ', subtitle: 'НАБЛЮДАТЕЛЬ ПУСТОГО НЕБА', radius: 57, hp: 2000, speed: 39, damage: 28, color: '#ae91e6' },
  forgemaster: { name: 'МАСТЕР ПЕПЕЛЬНОЙ КУЗНИ', subtitle: 'ЗАЖИГАЮЩИЙ СТАРЫЕ СЕРДЦА', radius: 62, hp: 3100, speed: 40, damage: 33, color: '#e28c4f' },
  librarian: { name: 'БЕЗЫМЯННЫЙ БИБЛИОТЕКАРЬ', subtitle: 'ПОСЛЕДНЯЯ ЗАКРЫТАЯ КНИГА', radius: 61, hp: 3250, speed: 41, damage: 32, color: '#73b9df' },
  crown: { name: 'КОРОНА БЕЗ НОСИТЕЛЯ', subtitle: 'ПОСЛЕДНИЙ ПРОТОКОЛ', radius: 70, hp: 5700, speed: 43, damage: 37, color: '#e2b05c' }
};

export const META_PERKS = {
  vitality: { name: 'Остаточная плоть', description: '+5 здоровья в начале уровня.', max: 3, costs: [20, 45, 80] },
  force: { name: 'Запомненный удар', description: '+4% урона в начале уровня.', max: 3, costs: [25, 50, 90] },
  greed: { name: 'Память магнита', description: '+10% получаемого Эха.', max: 3, costs: [20, 45, 80] }
};
