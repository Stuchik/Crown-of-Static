export const CLASSES = {
  swordsman: {
    name: 'Мечник', title: 'Клятва Клинка', icon: '╱', image: 'assets/class-swordsman.webp',
    hp: 125, speed: 192, damage: 1.16, primary: 'blade', accent: '#e4b35f',
    passive: 'Получает на 12% меньше контактного урона.', ability: 'Круговой разрез отражает вражеские снаряды.',
    objective: 'Способность создаёт защитный контур рядом с важной целью.'
  },
  archer: {
    name: 'Лучник', title: 'Глаз Пустоши', icon: '➶', image: 'assets/class-archer.webp',
    hp: 92, speed: 232, damage: 1.04, primary: 'bow', accent: '#ef9e55',
    passive: 'Каждое пятое попадание наносит критический урон.', ability: 'Выпускает веер из семи пробивающих стрел.',
    objective: 'Сразу видит тайные комнаты и осадные цели на мини-карте.'
  },
  mage: {
    name: 'Маг', title: 'Хранитель Формулы', icon: '✧', image: 'assets/class-mage.webp',
    hp: 82, speed: 204, damage: 1.12, primary: 'arcana', accent: '#b893ff',
    passive: 'Заклинания могут перескакивать между целями.', ability: 'Создаёт разлом, замедляющий и притягивающий врагов.',
    objective: 'На 25% быстрее активирует печати и заряжает безопасную зону.'
  },
  mechanist: {
    name: 'Механист', title: 'Руки Архива', icon: '⚙', image: 'assets/class-mechanist.webp',
    hp: 105, speed: 200, damage: 1.02, primary: 'repeater', accent: '#68dcc4',
    passive: 'Боевой дрон самостоятельно выбирает цели.', ability: 'Перегружает устройства и вызывает второго дрона.',
    objective: 'Медленно чинит защищаемые механизмы, находясь рядом.'
  }
};

export const RARITIES = {
  common: { name: 'ОБЫЧНЫЙ', color: '#aeb8b2', weight: 58 },
  rare: { name: 'РЕДКИЙ', color: '#58aef2', weight: 27 },
  epic: { name: 'ЭПИЧЕСКИЙ', color: '#b77cff', weight: 11 },
  legendary: { name: 'ЛЕГЕНДАРНЫЙ', color: '#f0bd58', weight: 4 },
  secret: { name: 'СЕКРЕТНЫЙ', color: '#ef5f83', weight: 0 }
};

export const CONTRACTS = {
  cull: { name: 'ЧИСТАЯ ЗОНА', icon: '✦', description: 'Уничтожить 75 противников.', reward: 24, type: 'kills' },
  unbroken: { name: 'БЕЗ ОШИБОК', icon: '◇', description: 'Получить не больше пяти попаданий.', reward: 30, type: 'hits' },
  discipline: { name: 'ПОЛНЫЙ ЗАРЯД', icon: 'ϟ', description: 'Использовать классовую способность восемь раз.', reward: 22, type: 'abilities' },
  pristine: { name: 'ЦЕЛЬ ПРЕЖДЕ ВСЕГО', icon: '⬡', description: 'Завершить уровень, сохранив цели не меньше 70% прочности.', reward: 34, type: 'objective', objectives: ['defense', 'escort'] },
  explorer: { name: 'ЗА СТЕНОЙ', icon: '⌖', description: 'Найти и зачистить тайную комнату.', reward: 28, type: 'secret' },
  noScrap: { name: 'БЕЗ РЕМОНТА', icon: '⚙', description: 'Не подбирать Scrap до завершения сектора.', reward: 27, type: 'scrap' }
};

export const SPECIALIZATIONS = {
  swordsman: {
    guardian: { name: 'Страж', title: 'Неподвижная клятва', icon: '⬡', accent: '#79d7be', description: 'Отражает часть урона и лучше удерживает толпу.', armor: .1 },
    executioner: { name: 'Палач', title: 'Последний приговор', icon: '✦', accent: '#ed8b62', description: 'Медленнее, но наносит тяжёлые размашистые удары.', damage: 1.16, speed: .94 }
  },
  archer: {
    hunter: { name: 'Охотник', title: 'Метка без промаха', icon: '⌖', accent: '#efb15b', description: 'Особенно опасен против элиты и боссов.', eliteDamage: 1.28 },
    stormshot: { name: 'Штормовой стрелок', title: 'Тетива грозы', icon: 'ϟ', accent: '#68cfee', description: 'Стрелы проводят разряды между ближайшими целями.', chainChance: .24 }
  },
  mage: {
    riftkeeper: { name: 'Хранитель разлома', title: 'Геометр тишины', icon: '◉', accent: '#9c89ef', description: 'Создаёт более крупные и долгие области контроля.', riftScale: 1.3 },
    battlemage: { name: 'Боевой маг', title: 'Формула удара', icon: '✹', accent: '#e67eb8', description: 'Сферы взрываются, но теряют один скачок.', blast: true }
  },
  mechanist: {
    engineer: { name: 'Инженер', title: 'Полевой протокол', icon: '⚒', accent: '#e4ae65', description: 'Усиливает мины, турели и лечение от Scrap.', scrapBonus: 1.35 },
    swarm: { name: 'Повелитель роя', title: 'Единый прицел', icon: '⌬', accent: '#5ce0c1', description: 'Начинает забег с дополнительным боевым дроном.', drones: 1 }
  }
};

export const STAGES = [
  {
    id: 'outer-ring', number: 1, title: 'Внешнее кольцо', subtitle: 'ПЕРВЫЙ СИГНАЛ',
    lore: 'Камень здесь помнит шаги тех, кто исчез раньше тебя.', objective: 'survive', duration: 180,
    x: 6, y: 50, accent: '#65dfbe', biome: 'ruins', enemies: ['husk', 'wisp', 'charger'], boss: 'archon', requires: []
  },
  {
    id: 'machine-garden', number: 2, title: 'Машинный сад', subtitle: 'ЛОЖНАЯ ЖИЗНЬ',
    lore: 'Сад растёт без солнца. Его корни сделаны из проводов.', objective: 'seals', duration: 210,
    x: 18, y: 28, accent: '#5ad8b7', biome: 'garden', enemies: ['drone', 'wisp', 'hound', 'repairer'], boss: 'gardener', requires: ['outer-ring']
  },
  {
    id: 'bone-observatory', number: 3, title: 'Обсерватория', subtitle: 'НЕБО БЕЗ ЗВЁЗД',
    lore: 'Приборы всё ещё следят за тем, чего больше нет.', objective: 'hunt', duration: 210,
    x: 18, y: 72, accent: '#a993e8', biome: 'observatory', enemies: ['seer', 'husk', 'charger', 'conductor'], boss: 'oracle', requires: ['outer-ring']
  },
  {
    id: 'static-foundry', number: 4, title: 'Кузница помех', subtitle: 'ЗАЩИТИТЬ ИСКРУ',
    lore: 'Старая кузница снова горит. Не дай ей погаснуть.', objective: 'defense', duration: 240,
    x: 32, y: 24, accent: '#ed9b54', biome: 'foundry', enemies: ['brute', 'drone', 'sentinel', 'warder'], boss: 'forgemaster', requires: ['machine-garden']
  },
  {
    id: 'silent-archive', number: 5, title: 'Безмолвный архив', subtitle: 'НАЙТИ ИМЕНА',
    lore: 'Книги закрыты. Их стражи — нет.', objective: 'hunt', duration: 270,
    x: 32, y: 76, accent: '#76b9e8', biome: 'archive', enemies: ['scribe', 'seer', 'hound', 'silencer'], boss: 'librarian', requires: ['bone-observatory']
  },
  {
    id: 'crown-heart', number: 6, title: 'Сердце Короны', subtitle: 'ПОСЛЕДНИЙ ПРОТОКОЛ',
    lore: 'Две дороги сходятся там, где механизм выбирает носителя.', objective: 'boss', duration: 360,
    x: 45, y: 50, accent: '#e2b05c', biome: 'crown', enemies: ['sentinel', 'scribe', 'brute', 'mirror'], boss: 'crown', requiresAny: ['static-foundry', 'silent-archive']
  },
  {
    id: 'broken-gates', number: 7, title: 'Разбитые врата', subtitle: 'ЗАКРЫТЬ ПРОХОДЫ', lore: 'Каждые открытые врата ведут в другую ошибку мира.', objective: 'portals', duration: 300,
    x: 58, y: 26, accent: '#e78266', biome: 'void', enemies: ['mirror', 'charger', 'silencer', 'brute'], boss: 'gatekeeper', requires: ['crown-heart']
  },
  {
    id: 'walking-temple', number: 8, title: 'Шагающий храм', subtitle: 'СОПРОВОЖДАТЬ МАШИНУ', lore: 'Храм помнит дорогу, но не умеет защищаться.', objective: 'escort', duration: 300,
    x: 58, y: 74, accent: '#6ad5ba', biome: 'garden', enemies: ['hound', 'drone', 'repairer', 'warder'], boss: 'pilgrim', requires: ['crown-heart']
  },
  {
    id: 'wandering-beacon', number: 9, title: 'Блуждающий маяк', subtitle: 'НЕ ПОКИДАТЬ СВЕТ', lore: 'Единственная безопасная точка постоянно меняет своё решение.', objective: 'zone', duration: 330,
    x: 70, y: 22, accent: '#70c8eb', biome: 'observatory', enemies: ['seer', 'conductor', 'wisp', 'mirror'], boss: 'beacon', requires: ['broken-gates']
  },
  {
    id: 'engine-graves', number: 10, title: 'Кладбище двигателей', subtitle: 'СОБРАТЬ МЕХАНИЗМ', lore: 'Четыре детали всё ещё спорят, какой машиной они были.', objective: 'parts', duration: 330,
    x: 70, y: 78, accent: '#e5a05e', biome: 'foundry', enemies: ['sentinel', 'repairer', 'brute', 'hound'], boss: 'salvager', requires: ['walking-temple']
  },
  {
    id: 'nameless-trail', number: 11, title: 'След без имени', subtitle: 'НАЙТИ НЕВИДИМОГО', lore: 'Охотник не виден. Его ошибки — видны.', objective: 'tracks', duration: 345,
    x: 82, y: 50, accent: '#b392ed', biome: 'archive', enemies: ['silencer', 'scribe', 'seer', 'mirror'], boss: 'stalker', requiresAny: ['wandering-beacon', 'engine-graves']
  },
  {
    id: 'double-signal', number: 12, title: 'Двойной сигнал', subtitle: 'РАЗОРВАТЬ СВЯЗЬ', lore: 'Два стража делят одну команду и одну ярость.', objective: 'twins', duration: 360,
    x: 94, y: 50, accent: '#e3bd6c', biome: 'crown', enemies: ['warder', 'conductor', 'mirror', 'sentinel'], boss: 'twinA', requires: ['nameless-trail']
  }
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
  },
  force: {
    name: 'Сжатая Искра', icon: '✦', category: 'artifacts', max: 4, accent: '#ef9b68',
    descriptions: ['Весь урон +8%.', 'Весь урон ещё +8%.', 'Весь урон ещё +10%.', 'Критический урон становится сильнее.']
  },
  focus: {
    name: 'Линза Предела', icon: '◉', category: 'artifacts', max: 3, accent: '#d7b6ef',
    descriptions: ['Шанс критического удара +7%.', 'Критический урон +25%.', 'Элита получает дополнительный критический урон.']
  },
  wisdom: {
    name: 'Память Архива', icon: '▤', category: 'artifacts', max: 3, accent: '#7fc5e8',
    descriptions: ['Получаемый опыт +12%.', 'Получаемый опыт ещё +12%.', 'Каждый десятый осколок опыта удваивается.']
  },
  salvage: {
    name: 'Искатель Деталей', icon: '⚙', category: 'artifacts', max: 3, accent: '#d5a85f',
    descriptions: ['Шанс найти Scrap и магнит повышается.', 'Scrap восстанавливает больше здоровья.', 'Элита гарантированно оставляет полезную деталь.']
  },
  reach: {
    name: 'Дальний Контур', icon: '⌁', category: 'artifacts', max: 3, accent: '#74d7c0',
    descriptions: ['Размер атак +10%.', 'Время жизни снарядов +20%.', 'Дальность оружия увеличивается ещё сильнее.']
  },
  capacitor: {
    name: 'Резервный Конденсатор', icon: 'ϟ', category: 'artifacts', max: 3, accent: '#7ebee9',
    descriptions: ['Перезарядка способности -10%.', 'Перезарядка способности ещё -10%.', 'Использование способности ненадолго ускоряет атаки.']
  },
  afterimage: {
    name: 'След Разгона', icon: '»', category: 'artifacts', max: 3, accent: '#5fd9c4',
    descriptions: ['Рывок оставляет повреждающий след.', 'След становится шире и сильнее.', 'В конце рывка возникает второй импульс.']
  },
  overcharger: {
    name: 'Хищный Контур', icon: '↻', category: 'artifacts', max: 3, accent: '#64bdf0',
    descriptions: ['Победы немного ускоряют классовую способность.', 'Сокращение перезарядки усиливается.', 'Элита мгновенно возвращает часть заряда.']
  },
  echoShell: {
    name: 'Оболочка Тишины', icon: '◈', category: 'artifacts', max: 3, accent: '#b77cff',
    descriptions: ['После семи секунд без урона атаки сильнее.', 'Бонус урона возрастает.', 'Тишина также даёт дополнительную броню.']
  },
  phaseHeart: {
    name: 'Фазовое Сердце', icon: '♥', category: 'artifacts', max: 1, accent: '#f0bd58',
    descriptions: ['Один раз предотвращает поражение, восстанавливает 35% здоровья и создаёт волну.']
  },
  nova: {
    name: 'Звёздный Разрядник', icon: '✺', category: 'weapons', max: 4, accent: '#f0bd58',
    descriptions: ['Периодически выпускает мощную круговую волну.', 'Волна заряжается быстрее.', 'Добавляет внешний разряд.', 'Нова наносит больше урона элите и боссам.']
  },
  singularity: {
    name: 'Нулевая Сингулярность', icon: '●', category: 'weapons', max: 3, accent: '#ef5f83',
    descriptions: ['Создаёт нестабильную точку притяжения.', 'Область становится больше и опаснее.', 'После схлопывания возникает ударная волна.']
  },
  archiveKey: {
    name: 'Ключ Непрочитанной Двери', icon: '⌑', category: 'artifacts', max: 1, accent: '#ef5f83',
    descriptions: ['Повышает получаемый опыт и шанс увидеть предметы высокой редкости.']
  },
  aegis: {
    name: 'Контур Эгиды', icon: '⬡', category: 'talents', classes: ['swordsman'], spec: 'guardian', max: 3, accent: '#79d7be',
    descriptions: ['Каждые 18 секунд блокирует попадание.', 'Блок создаёт отражающую волну.', 'Время восстановления блока сокращается.']
  },
  bastion: {
    name: 'Шаг Бастиона', icon: '▣', category: 'talents', classes: ['swordsman'], spec: 'guardian', max: 3, accent: '#8bd8c5',
    descriptions: ['Во время атаки броня возрастает.', 'Разрез сильнее отталкивает врагов.', 'Круговой разрез оставляет защитный след.']
  },
  severance: {
    name: 'Грань Приговора', icon: '╱', category: 'talents', classes: ['swordsman'], spec: 'executioner', max: 3, accent: '#ed8b62',
    descriptions: ['Основной разрез наносит +18% урона.', 'Урон по раненым целям увеличивается.', 'Каждый четвёртый разрез становится двойным.']
  },
  momentum: {
    name: 'Неумолимый Ход', icon: '≫', category: 'talents', classes: ['swordsman'], spec: 'executioner', max: 3, accent: '#e49a73',
    descriptions: ['Победа над врагом ускоряет следующую атаку.', 'Эффект может складываться трижды.', 'Элита сразу даёт максимум ускорения.']
  },
  preyMark: {
    name: 'Метка Добычи', icon: '⌖', category: 'talents', classes: ['archer'], spec: 'hunter', max: 3, accent: '#efb15b',
    descriptions: ['Урон по элите и боссам +15%.', 'Стрелы помечают цель для следующего выстрела.', 'Метка усиливает критические попадания.']
  },
  ghostQuiver: {
    name: 'Призрачный Колчан', icon: '⫷', category: 'talents', classes: ['archer'], spec: 'hunter', max: 3, accent: '#e9c177',
    descriptions: ['Каждый шестой выстрел выпускает дополнительную стрелу.', 'Дополнительная стрела ищет новую цель.', 'Срабатывает каждый четвёртый выстрел.']
  },
  voltage: {
    name: 'Грозовая Нить', icon: 'ϟ', category: 'talents', classes: ['archer'], spec: 'stormshot', max: 3, accent: '#68cfee',
    descriptions: ['Шанс электрического скачка повышается.', 'Разряд может перескочить ещё раз.', 'Разряд наносит больше урона.']
  },
  stormQuiver: {
    name: 'Колчан Разряда', icon: '≋', category: 'talents', classes: ['archer'], spec: 'stormshot', max: 3, accent: '#82d9ee',
    descriptions: ['Способность перезаряжается быстрее.', 'Веер стрел шире.', 'После способности остаётся электрическое поле.']
  },
  gravityWell: {
    name: 'Гравитационный Узел', icon: '◉', category: 'talents', classes: ['mage'], spec: 'riftkeeper', max: 3, accent: '#9c89ef',
    descriptions: ['Разлом притягивает сильнее.', 'Радиус разлома увеличивается.', 'Разлом наносит урон чаще.']
  },
  continuum: {
    name: 'Замкнутый Континуум', icon: '∞', category: 'talents', classes: ['mage'], spec: 'riftkeeper', max: 3, accent: '#ae9af3',
    descriptions: ['Разлом существует дольше.', 'Перезарядка способности сокращается.', 'После исчезновения разлом создаёт импульс.']
  },
  detonation: {
    name: 'Взрывная Формула', icon: '✹', category: 'talents', classes: ['mage'], spec: 'battlemage', max: 3, accent: '#e67eb8',
    descriptions: ['Сферы поражают область вокруг цели.', 'Радиус взрыва увеличивается.', 'Последний скачок наносит двойной урон.']
  },
  spellguard: {
    name: 'Печать Боевого Мага', icon: '◇', category: 'talents', classes: ['mage'], spec: 'battlemage', max: 3, accent: '#dc91bd',
    descriptions: ['Способность даёт короткую неуязвимость.', 'Во время неё урон возрастает.', 'Первое попадание после способности отражается.']
  },
  turretKit: {
    name: 'Полевой Комплект', icon: '⚒', category: 'talents', classes: ['mechanist'], spec: 'engineer', max: 3, accent: '#e4ae65',
    descriptions: ['Мины быстрее превращаются в турели.', 'Турели стреляют чаще.', 'Одновременно работает ещё одна турель.']
  },
  repairProtocol: {
    name: 'Ремонтный Протокол', icon: '⚙', category: 'talents', classes: ['mechanist'], spec: 'engineer', max: 3, accent: '#daba79',
    descriptions: ['Scrap лечит ещё на 8% здоровья.', 'Scrap также восстанавливает ближайшие устройства.', 'Подбор Scrap создаёт бесплатную мину.']
  },
  swarmCore: {
    name: 'Ядро Роя', icon: '⌬', category: 'talents', classes: ['mechanist'], spec: 'swarm', max: 3, accent: '#5ce0c1',
    descriptions: ['Дополнительный дрон наносит больше урона.', 'Добавляет ещё один дрон.', 'Дроны выпускают двойной залп.']
  },
  targetMesh: {
    name: 'Единая Сетка Целей', icon: '⌁', category: 'talents', classes: ['mechanist'], spec: 'swarm', max: 3, accent: '#79e2ca',
    descriptions: ['Дроны быстрее находят следующую цель.', 'Каждая четвёртая очередь пробивает врага.', 'Все дроны повторяют классовую способность.']
  }
};

const rarityGroups = {
  rare: ['halo', 'mines', 'recovery', 'fortune', 'force', 'salvage', 'capacitor', 'afterimage', 'overcharger', 'aegis', 'bastion', 'severance', 'momentum', 'preyMark', 'ghostQuiver', 'voltage', 'stormQuiver', 'continuum', 'spellguard', 'repairProtocol', 'targetMesh'],
  epic: ['thorns', 'storm', 'frost', 'focus', 'echoShell', 'gravityWell', 'detonation', 'turretKit', 'swarmCore'],
  legendary: ['phaseHeart', 'nova'],
  secret: ['singularity', 'archiveKey']
};
for (const [rarity, ids] of Object.entries(rarityGroups)) for (const id of ids) UPGRADES[id].rarity = rarity;
for (const item of Object.values(UPGRADES)) item.rarity ||= 'common';

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
  },
  glacier: {
    name: 'Белая Орбита', icon: '❄', accent: '#82c9ed', recipe: ['frost', 'reach'], levels: [4, 3],
    description: 'Холодная волна замораживает ближайших врагов и создаёт осколки.'
  },
  thunderhead: {
    name: 'Грозовой Горизонт', icon: 'ϟ', accent: '#9bcbf1', recipe: ['storm', 'focus'], levels: [4, 3],
    description: 'Критические удары вызывают дополнительную цепную молнию.'
  },
  mobileFoundry: {
    name: 'Походная Кузница', icon: '⚙', accent: '#e6a166', recipe: ['mines', 'salvage'], levels: [4, 3],
    description: 'Мины превращаются в турели и иногда создают Scrap.'
  },
  livingWall: {
    name: 'Живая Стена', icon: '✣', accent: '#c2a0ec', recipe: ['thorns', 'vitality'], levels: [4, 3],
    description: 'Получение урона немедленно создаёт защитное кольцо шипов.'
  },
  solarClock: {
    name: 'Солнечный Часовой', icon: '✺', accent: '#efc36d', recipe: ['halo', 'capacitor'], levels: [4, 3],
    description: 'Использование способности ускоряет Нимб и добавляет временный осколок.'
  }
};

export const ENEMIES = {
  husk: { name: 'Пустая оболочка', family: 'ЗАБЛУДШИЕ', radius: 15, hp: 30, speed: 63, damage: 10, xp: 1, color: '#88a99c', shape: 'husk' },
  wisp: { name: 'Искра могилы', family: 'НАБЛЮДАТЕЛИ', radius: 10, hp: 19, speed: 91, damage: 8, xp: 1, color: '#73dcbc', shape: 'wisp' },
  drone: { name: 'Слепой дрон', family: 'ЛАТУННЫЙ РОЙ', radius: 14, hp: 48, speed: 55, damage: 11, xp: 2, color: '#d6ac62', shape: 'drone', ranged: true },
  charger: { name: 'Рваный рыцарь', family: 'ЗАБЛУДШИЕ', radius: 18, hp: 70, speed: 49, damage: 17, xp: 3, color: '#8fa3dc', shape: 'charger', charger: true },
  brute: { name: 'Каменный счетовод', family: 'ИСКАЖЁННЫЕ', radius: 24, hp: 135, speed: 38, damage: 20, xp: 5, color: '#b87959', shape: 'brute' },
  seer: { name: 'Слепой астроном', family: 'НАБЛЮДАТЕЛИ', radius: 16, hp: 58, speed: 46, damage: 13, xp: 3, color: '#b792ee', shape: 'seer', ranged: true },
  hound: { name: 'Латунная гончая', family: 'ЛАТУННЫЙ РОЙ', radius: 13, hp: 42, speed: 108, damage: 12, xp: 2, color: '#df985a', shape: 'hound' },
  sentinel: { name: 'Страж кузницы', family: 'ЛАТУННЫЙ РОЙ', radius: 20, hp: 105, speed: 43, damage: 18, xp: 4, color: '#e1804d', shape: 'sentinel', ranged: true },
  scribe: { name: 'Переписчик', family: 'АРХИВАРИУСЫ', radius: 17, hp: 78, speed: 52, damage: 14, xp: 3, color: '#70b7df', shape: 'scribe', ranged: true },
  warder: { name: 'Щитоносец Сигнала', family: 'ИСКАЖЁННЫЕ', radius: 21, hp: 125, speed: 40, damage: 12, xp: 4, color: '#83b8a5', shape: 'warder', support: 'shield' },
  repairer: { name: 'Ремонтная Оса', family: 'ЛАТУННЫЙ РОЙ', radius: 12, hp: 45, speed: 67, damage: 8, xp: 3, color: '#e3bd69', shape: 'repairer', support: 'repair', ranged: true },
  conductor: { name: 'Дирижёр Пустоты', family: 'НАБЛЮДАТЕЛИ', radius: 18, hp: 82, speed: 45, damage: 13, xp: 4, color: '#a98aeb', shape: 'conductor', support: 'command' },
  silencer: { name: 'Глушитель Формул', family: 'АРХИВАРИУСЫ', radius: 17, hp: 76, speed: 50, damage: 12, xp: 4, color: '#6fb5d9', shape: 'silencer', support: 'silence', ranged: true },
  mirror: { name: 'Зеркальная Ошибка', family: 'ИСКАЖЁННЫЕ', radius: 19, hp: 92, speed: 57, damage: 15, xp: 4, color: '#d28cc2', shape: 'mirror', support: 'clone' }
};

export const BOSSES = {
  archon: { name: 'АРХОНТ НУЛЯ', subtitle: 'СТРАЖ ВНЕШНЕГО КРУГА', radius: 52, hp: 1300, speed: 34, damage: 26, color: '#d4a45c' },
  gardener: { name: 'САДОВНИК МЕДИ', subtitle: 'ТОТ, КТО ВЫРАЩИВАЕТ МАШИНЫ', radius: 56, hp: 1900, speed: 37, damage: 28, color: '#62d2a9' },
  oracle: { name: 'ОРБИТАЛЬНЫЙ ОРАКУЛ', subtitle: 'НАБЛЮДАТЕЛЬ ПУСТОГО НЕБА', radius: 57, hp: 2000, speed: 39, damage: 28, color: '#ae91e6' },
  forgemaster: { name: 'МАСТЕР ПЕПЕЛЬНОЙ КУЗНИ', subtitle: 'ЗАЖИГАЮЩИЙ СТАРЫЕ СЕРДЦА', radius: 62, hp: 3100, speed: 40, damage: 33, color: '#e28c4f' },
  librarian: { name: 'БЕЗЫМЯННЫЙ БИБЛИОТЕКАРЬ', subtitle: 'ПОСЛЕДНЯЯ ЗАКРЫТАЯ КНИГА', radius: 61, hp: 3250, speed: 41, damage: 32, color: '#73b9df' },
  crown: { name: 'КОРОНА БЕЗ НОСИТЕЛЯ', subtitle: 'ПОСЛЕДНИЙ ПРОТОКОЛ', radius: 70, hp: 5700, speed: 43, damage: 37, color: '#e2b05c' },
  gatekeeper: { name: 'СМОТРИТЕЛЬ ВРАТ', subtitle: 'ЗАКРЫВАЮЩИЙ ПРОХОДЫ', radius: 64, hp: 4400, speed: 42, damage: 34, color: '#e78266' },
  pilgrim: { name: 'ЛОЖНЫЙ ПИЛИГРИМ', subtitle: 'ИДУЩИЙ ЗА ХРАМОМ', radius: 65, hp: 4600, speed: 46, damage: 35, color: '#6ad5ba' },
  beacon: { name: 'ПОГАСШИЙ МАЯК', subtitle: 'СВЕТ, КОТОРЫЙ ОХОТИТСЯ', radius: 67, hp: 5000, speed: 44, damage: 36, color: '#70c8eb' },
  salvager: { name: 'СБОРЩИК ДВИГАТЕЛЕЙ', subtitle: 'ХОЗЯИН ЧУЖИХ ДЕТАЛЕЙ', radius: 68, hp: 5300, speed: 41, damage: 38, color: '#e5a05e' },
  stalker: { name: 'ОХОТНИК БЕЗ ИМЕНИ', subtitle: 'СЛЕД, КОТОРЫЙ ДОГНАЛ', radius: 61, hp: 5600, speed: 58, damage: 38, color: '#b392ed' },
  twinA: { name: 'ПЕРВЫЙ СИГНАЛ', subtitle: 'ПОЛОВИНА ЕДИНОЙ КОМАНДЫ', radius: 55, hp: 4800, speed: 48, damage: 34, color: '#e3bd6c' },
  twinB: { name: 'ВТОРОЙ СИГНАЛ', subtitle: 'ПОЛОВИНА ЕДИНОЙ КОМАНДЫ', radius: 55, hp: 4800, speed: 48, damage: 34, color: '#8acbc0' }
};

export const META_PERKS = {
  vitality: { name: 'Остаточная плоть', description: '+5 здоровья в начале уровня.', max: 3, costs: [20, 45, 80] },
  force: { name: 'Запомненный удар', description: '+4% урона в начале уровня.', max: 3, costs: [25, 50, 90] },
  greed: { name: 'Память магнита', description: '+10% получаемого Эха.', max: 3, costs: [20, 45, 80] },
  swiftness: { name: 'Запомненный шаг', description: '+3% скорости движения.', max: 3, costs: [20, 45, 75] },
  learning: { name: 'Быстрое чтение', description: '+5% получаемого опыта.', max: 3, costs: [25, 50, 85] },
  salvage: { name: 'Чутьё механика', description: 'Повышает шанс выпадения Scrap.', max: 3, costs: [25, 55, 95] },
  ward: { name: 'Остаточная броня', description: '-3% получаемого урона.', max: 3, costs: [30, 60, 100] },
  charge: { name: 'Память конденсатора', description: '-3% перезарядки способности.', max: 3, costs: [30, 65, 105] },
  cartography: { name: 'Живая карта', description: '+12% радиуса мини-карты.', max: 3, costs: [15, 35, 65] }
};

export const EVENTS = {
  altar: { name: 'Алтарь', icon: '◇', accent: '#d38d9d', description: 'Следующий носитель отдаст часть здоровья и начнёт с редким артефактом.' },
  forge: { name: 'Кузница', icon: '⚒', accent: '#e5a05e', description: 'Основное оружие начнёт следующий уровень со второго ранга.' },
  anomaly: { name: 'Аномалия', icon: '◉', accent: '#ad8de8', description: 'На следующем уровне станет больше элиты, но награда Эха возрастёт.' },
  archive: { name: 'Архив', icon: '▤', accent: '#76b9e8', description: 'Открывает неизвестную страницу и ускоряет получение опыта.' },
  merchant: { name: 'Странствующий мастер', icon: '⌬', accent: '#6bd9bd', description: 'За 30 Эха подготовит два случайных артефакта.' },
  signal: { name: 'Неизвестный сигнал', icon: 'ϟ', accent: '#e9c16d', description: 'Призывает дополнительную элиту с увеличенной наградой.' }
};
