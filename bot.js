const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const XLSX = require('xlsx');

// Уникальные номера билетов
let ticketNumbers = new Set();
let userLanguage = {};

// Генерация номеров билетов от 00001 до 200000 и сохранение в JSON-файл
for (let i = 1; i <= 200000; i++) {
  ticketNumbers.add(i.toString().padStart(5, '0'));
}
fs.writeFileSync('ticketNumbers.json', JSON.stringify(Array.from(ticketNumbers)));

// Загрузка номеров билетов из файла
let availableTickets = new Set(JSON.parse(fs.readFileSync('ticketNumbers.json')));
let usedTickets = new Set();
let registrations = [];

// Инициализация бота
const token = '7719060858:AAF1Kb_qSL1F2dJfeeZtrvlmns798Z2stw8';
const bot = new TelegramBot(token, { polling: true });

// Генерация регистрационного номера
let registrationCounter = 1;
const generateRegistrationNumber = () => {
  return (registrationCounter++).toString().padStart(6, '0');
};

// Функция для проверки действительности билета
const isValidTicket = (ticketNumber) => {
  return availableTickets.has(ticketNumber) && !usedTickets.has(ticketNumber);
};

// Функция для сохранения данных в Excel
const saveToExcel = (newRegistration) => {
  let workbook;
  if (fs.existsSync('registrations.xlsx')) {
    workbook = XLSX.readFile('registrations.xlsx');
  } else {
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), 'Registrations');
  }
  const sheet = workbook.Sheets['Registrations'];
  const data = XLSX.utils.sheet_to_json(sheet);
  data.push(newRegistration);
  const updatedSheet = XLSX.utils.json_to_sheet(data);
  workbook.Sheets['Registrations'] = updatedSheet;
  XLSX.writeFile(workbook, 'registrations.xlsx');
};

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Добро пожаловать в телеграм-бот TAZA! Выберите язык: Русский / Қазақша.', {
    reply_markup: {
      keyboard: [['Русский', 'Қазақша']],
      one_time_keyboard: true
    }
  });
});

// Обработка выбора языка
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (msg.text === 'Русский') {
    userLanguage[chatId] = 'ru';
    bot.sendMessage(chatId, 'Пожалуйста, отправьте номер вашей карточки (5-значный код).');
  } else if (msg.text === 'Қазақша') {
    userLanguage[chatId] = 'kk';
    bot.sendMessage(chatId, 'Өтініш, 5-санды карта нөмірін жіберіңіз.');
  }

  // Обработка номера карточки
  if (/^\d{5}$/.test(msg.text)) {
    const ticketNumber = msg.text;
    const lang = userLanguage[chatId] || 'ru';

    if (isValidTicket(ticketNumber)) {
      const response = lang === 'ru' 
        ? 'Поздравляю! Ваш номер есть в базе. Пожалуйста, отправьте фото карточки.'
        : 'Құттықтаймын! Сіздің нөміріңіз базаға енгізілген. Картаңыздың суретін жіберіңіз.';

      bot.sendMessage(chatId, response);

      // Ожидание фото
      bot.once('photo', (photoMsg) => {
        const fioRequest = lang === 'ru' 
          ? 'Отлично! Теперь укажите ваше ФИО.'
          : 'Тамаша! Енді толық атыңызды енгізіңіз.';
        bot.sendMessage(chatId, fioRequest);

        // Ожидание ФИО
        bot.once('message', (fioMsg) => {
          const fio = fioMsg.text;
          const phoneRequest = lang === 'ru' 
            ? 'Теперь укажите ваш номер телефона.'
            : 'Енді телефон нөміріңізді енгізіңіз.';
          bot.sendMessage(chatId, phoneRequest);

          // Ожидание номера телефона
          bot.once('message', (phoneMsg) => {
            const phone = phoneMsg.text;
            const confirmMessage = lang === 'ru' 
              ? `Проверьте, пожалуйста, правильность данных:\nФИО: ${fio}\nТелефон: ${phone}`
              : `Деректердің дұрыстығын тексеріңіз:\nТолық аты-жөніңіз: ${fio}\nТелефон нөміріңіз: ${phone}`;
            bot.sendMessage(chatId, confirmMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: lang === 'ru' ? 'Да' : 'Иә', callback_data: 'confirm_yes' }],
                  [{ text: lang === 'ru' ? 'Нет' : 'Жоқ', callback_data: 'confirm_no' }]
                ]
              }
            });

            // Подтверждение данных
            bot.once('callback_query', (callbackQuery) => {
              const data = callbackQuery.data;
              if (data === 'confirm_yes') {
                const registrationNumber = generateRegistrationNumber();
                const newRegistration = {
                  ticketNumber: ticketNumber,
                  fio: fio,
                  phone: phone,
                  registrationNumber: registrationNumber,
                  date: new Date().toLocaleString()
                };

                registrations.push(newRegistration);
                usedTickets.add(ticketNumber);
                saveToExcel(newRegistration);

                const successMessage = lang === 'ru' 
                  ? `Поздравляю, вы успешно зарегистрированы! Ваш регистрационный номер: ${registrationNumber}.`
                  : `Құттықтаймыз, сіз сәтті тіркелдіңіз! Тіркеу нөміріңіз: ${registrationNumber}.`;

                bot.sendMessage(chatId, successMessage);
              } else {
                const retryMessage = lang === 'ru' 
                  ? 'Пожалуйста, начните процесс регистрации снова.'
                  : 'Тіркеу процесін қайта бастаңыз.';
                bot.sendMessage(chatId, retryMessage);
              }
            });
          });
        });
      });
    } else {
      const errorMessage = lang === 'ru' 
        ? 'Извините, ваш номер не найден или уже зарегистрирован.'
        : 'Кешіріңіз, сіздің нөміріңіз табылмады немесе тіркелген.';
      bot.sendMessage(chatId, errorMessage);
    }
  }
});

// Команда /mynumber для получения регистрационного номера
bot.onText(/\/mynumber/, (msg) => {
  const chatId = msg.chat.id;
  const lang = userLanguage[chatId] || 'ru';

  const userRegistration = registrations.find(reg => reg.phone === msg.contact?.phone_number);
  const response = userRegistration
    ? (lang === 'ru' 
      ? `Ваш регистрационный номер: ${userRegistration.registrationNumber}`
      : `Сіздің тіркеу нөміріңіз: ${userRegistration.registrationNumber}`)
    : (lang === 'ru' 
      ? 'Вы еще не зарегистрированы.'
      : 'Сіз әлі тіркелмегенсіз.');

  bot.sendMessage(chatId, response);
});

