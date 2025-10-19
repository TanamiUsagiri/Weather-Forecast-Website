const API_KEY = "";

document.getElementById("searchBtn").addEventListener("click", async () => {
  const city = document.getElementById("cityInput").value;
  if (!city) return alert("Vui lòng nhập tên thành phố!");

  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("cityInput");
  
  // Add loading state
  searchBtn.classList.add("loading");
  searchBtn.disabled = true;
  searchInput.disabled = true;

  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=vi&format=json`);
    if (!geoRes.ok) throw new Error(`Geo API lỗi: ${geoRes.status}`);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      alert("Không tìm thấy thành phố!");
      return;
    }
    const { latitude, longitude, name, country_code } = geoData.results[0];
    await getWeather(latitude, longitude, name, country_code);
  } catch (err) {
    console.error(err);
    alert("Không thể gọi API vị trí. Kiểm tra kết nối mạng.");
  } finally {
    // Remove loading state
    searchBtn.classList.remove("loading");
    searchBtn.disabled = false;
    searchInput.disabled = false;
  }
});

// Submit on Enter for better UX
document.getElementById("cityInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    document.getElementById("searchBtn").click();
  }
});

// Load Hà Nội by default on first load
window.addEventListener("DOMContentLoaded", () => {
  const defaultCity = { name: "Hà Nội", country: "VN", lat: 21.0278, lon: 105.8342 };
  getWeather(defaultCity.lat, defaultCity.lon, defaultCity.name, defaultCity.country);
});

// Autocomplete suggestions
const cityInputEl = document.getElementById("cityInput");
const suggestionsEl = document.getElementById("suggestions");
let debounceTimer;
let lastResults = [];

cityInputEl.addEventListener("input", () => {
  const q = cityInputEl.value.trim();
  clearTimeout(debounceTimer);
  if (q.length < 2) { suggestionsEl.classList.remove("visible"); return; }
  debounceTimer = setTimeout(async () => {
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=7&language=vi&format=json`);
      if (!r.ok) return;
      const data = await r.json();
      lastResults = data.results || [];
      if (!lastResults.length) { suggestionsEl.classList.remove("visible"); return; }
      const html = lastResults.map((it, idx) => {
        const line = `${it.name}, ${it.country_code}${it.admin1 ? " - " + it.admin1 : ""}`;
        return `<div class="suggestion-item" data-idx="${idx}">${line}</div>`;
      }).join("");
      suggestionsEl.innerHTML = html;
      suggestionsEl.classList.add("visible");
    } catch {}
  }, 250);
});

// Click selection
suggestionsEl.addEventListener("click", (e) => {
  const item = e.target.closest('.suggestion-item');
  if (!item) return;
  const idx = Number(item.getAttribute('data-idx'));
  const sel = lastResults[idx];
  if (!sel) return;
  cityInputEl.value = `${sel.name}`;
  suggestionsEl.classList.remove("visible");
  getWeather(sel.latitude, sel.longitude, sel.name, sel.country_code);
});

// Hide on blur
document.addEventListener('click', (e) => {
  if (!suggestionsEl.contains(e.target) && e.target !== cityInputEl) {
    suggestionsEl.classList.remove('visible');
  }
});

async function getWeather(lat, lon, city, country) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo lỗi: ${res.status}`);
    const data = await res.json();

  // Thời tiết hiện tại
  const current = data.current_weather;
  document.getElementById("currentWeather").innerHTML = `
    <h2>${city}, ${country}</h2>
    <h3>${Math.round(current.temperature)}°C</h3>
    <p>${weatherCodeToText(current.weathercode)}</p>
    <p>Gió: ${current.windspeed} km/h</p>
  `;

  // 7 ngày tới
  const days = data.daily.time;
  const dailyHTML = days.slice(0, 7).map((d, i) => {
    const date = new Date(d);
    const weekday = date.toLocaleDateString("vi-VN", { weekday: 'short' });
    const code = data.daily.weathercode[i];
    const tmax = Math.round(data.daily.temperature_2m_max[i]);
    const tmin = Math.round(data.daily.temperature_2m_min[i]);
    const weatherClass = getWeatherClass(code);
    return `
      <div class="card ${weatherClass}">
        <h4>${weekday}</h4>
        <p>${tmax}° / ${tmin}°</p>
        <small>${weatherCodeToText(code)}</small>
      </div>
    `;
  }).join("");
  document.getElementById("forecast7Days").innerHTML = dailyHTML;

  // Dự báo theo giờ
  const hourlyTimes = data.hourly.time;
  const hourlyTemps = data.hourly.temperature_2m;
  const hourlyCodes = data.hourly.weathercode;
  const hourlyHTML = hourlyTimes.slice(0, 8).map((t, i) => {
    const time = new Date(t).getHours();
    const weatherClass = getWeatherClass(hourlyCodes[i]);
    return `
      <div class="card ${weatherClass}">
        <h4>${time}:00</h4>
        <p>${Math.round(hourlyTemps[i])}°C</p>
      </div>
    `;
  }).join("");
  document.getElementById("hourlyForecast").innerHTML = hourlyHTML;

  // Thông tin thêm
  const sunrise = new Date(data.daily.sunrise[0]).toLocaleTimeString("vi-VN");
  const sunset = new Date(data.daily.sunset[0]).toLocaleTimeString("vi-VN");

  document.getElementById("sun-info").innerHTML = `
    <h4>☀️ Mặt trời</h4>
    <p>Mọc: ${sunrise}</p>
    <p>Lặn: ${sunset}</p>
  `;
  document.getElementById("temp-info").innerHTML = `
    <h4>🌡️ Nhiệt độ</h4>
    <p>Nhiệt độ hiện tại: ${Math.round(current.temperature)}°C</p>
    <p>Tốc độ gió: ${current.windspeed} km/h</p>
  `;
  document.getElementById("rain-info").innerHTML = `
    <h4>Tanami</h4>
    <p>nguyenphongtan2004@gmail.com</p>
  `;

  // Cập nhật nền theo mã thời tiết và ngày/đêm
  const now = new Date();
  const sunriseDt = new Date(data.daily.sunrise[0]);
  const sunsetDt = new Date(data.daily.sunset[0]);
  const isNight = now < sunriseDt || now > sunsetDt;
  updateBackgroundTheme(current.weathercode, isNight);
  } catch (err) {
    console.error(err);
    alert("Đã xảy ra lỗi khi tải dữ liệu thời tiết.");
  }
}

function weatherCodeToText(code) {
  const map = {
    0: "Trời quang",
    1: "Ít mây",
    2: "Có mây",
    3: "Nhiều mây",
    45: "Sương mù",
    48: "Sương mù đóng băng",
    51: "Mưa phùn nhẹ",
    53: "Mưa phùn",
    55: "Mưa phùn dày",
    56: "Mưa phùn đóng băng nhẹ",
    57: "Mưa phùn đóng băng dày",
    61: "Mưa nhẹ",
    63: "Mưa vừa",
    65: "Mưa to",
    66: "Mưa đóng băng nhẹ",
    67: "Mưa đóng băng mạnh",
    71: "Tuyết nhẹ",
    73: "Tuyết vừa",
    75: "Tuyết to",
    77: "Mưa tuyết",
    80: "Mưa rào nhẹ",
    81: "Mưa rào",
    82: "Mưa rào mạnh",
    95: "Dông",
    96: "Dông kèm mưa đá nhẹ",
    99: "Dông kèm mưa đá mạnh",
  };
  return map[code] || "Thời tiết";
}

// Hàm phân loại thời tiết cho CSS class
function getWeatherClass(code) {
  // Clear / mainly clear
  if ([0, 1].includes(code)) return "weather-clear";
  // Cloudy variants
  if ([2, 3].includes(code)) return "weather-cloudy";
  // Fog
  if ([45, 48].includes(code)) return "weather-fog";
  // Drizzle and rain (51-67, 80-82)
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "weather-rain";
  // Snow (71-77)
  if (code >= 71 && code <= 77) return "weather-snow";
  // Thunder (95-99)
  if (code >= 95 && code <= 99) return "weather-thunder";
  return "weather-clear"; // default
}

// Xác định class nền dựa vào weathercode và trạng thái ngày/đêm
function getBackgroundClass(weatherCode, isNight) {
  // Clear / mainly clear
  if ([0, 1].includes(weatherCode)) return isNight ? "bg-night-clear" : "bg-day-clear";
  // Cloudy variants
  if ([2, 3].includes(weatherCode)) return isNight ? "bg-night-cloudy" : "bg-day-cloudy";
  // Fog
  if ([45, 48].includes(weatherCode)) return "bg-fog";
  // Drizzle and rain (51-67, 80-82)
  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) return "bg-rain";
  // Snow (71-77)
  if (weatherCode >= 71 && weatherCode <= 77) return "bg-snow";
  // Thunder (95-99)
  if (weatherCode >= 95 && weatherCode <= 99) return "bg-thunder";
  return "bg-default";
}

function updateBackgroundTheme(weatherCode, isNight) {
  const cls = getBackgroundClass(weatherCode, isNight);
  const body = document.body;
  const all = [
    "bg-day-clear","bg-day-cloudy","bg-fog","bg-rain","bg-thunder","bg-snow",
    "bg-night-clear","bg-night-cloudy","bg-default"
  ];
  all.forEach(c => body.classList.remove(c));
  body.classList.add(cls);
}

// AI Weather Chatbot Logic
let currentWeatherData = null;
let isChatbotOpen = false;

// Chatbot toggle functionality
document.getElementById('chatbot-toggle').addEventListener('click', () => {
  const chatbotWindow = document.getElementById('chatbot-window');
  if (isChatbotOpen) {
    chatbotWindow.classList.add('hidden');
    chatbotWindow.classList.remove('show');
    isChatbotOpen = false;
  } else {
    chatbotWindow.classList.remove('hidden');
    setTimeout(() => chatbotWindow.classList.add('show'), 10);
    isChatbotOpen = true;
  }
});

// Close chatbot
document.getElementById('chatbot-close').addEventListener('click', () => {
  const chatbotWindow = document.getElementById('chatbot-window');
  chatbotWindow.classList.remove('show');
  setTimeout(() => chatbotWindow.classList.add('hidden'), 300);
  isChatbotOpen = false;
});

// Send message functionality
document.getElementById('chatbot-send').addEventListener('click', sendMessage);
document.getElementById('chatbot-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

function sendMessage() {
  const input = document.getElementById('chatbot-input');
  const message = input.value.trim();
  if (!message) return;

  // Add user message to chat
  addMessage(message, 'user');
  input.value = '';

  // Generate AI response
  setTimeout(() => {
    const response = generateWeatherResponse(message);
    addMessage(response, 'bot');
  }, 1000);
}

function addMessage(content, sender) {
  const messagesContainer = document.getElementById('chatbot-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chatbot-message ${sender}-message`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  
  if (sender === 'bot') {
    messageContent.innerHTML = `<i class="fas fa-robot"></i>${content}`;
  } else {
    messageContent.textContent = content;
  }
  
  messageDiv.appendChild(messageContent);
  messagesContainer.appendChild(messageDiv);
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function generateWeatherResponse(userMessage) {
  const message = userMessage.toLowerCase();
  
  // Weather advice patterns
  if (message.includes('nhiệt độ') || message.includes('nóng') || message.includes('lạnh')) {
    if (currentWeatherData) {
      const temp = Math.round(currentWeatherData.current_weather.temperature);
      if (temp > 30) {
        return `Nhiệt độ hiện tại là ${temp}°C - khá nóng! Bạn nên mặc quần áo mỏng, uống nhiều nước và tránh ra ngoài vào giờ cao điểm (11h-15h).`;
      } else if (temp < 15) {
        return `Nhiệt độ hiện tại là ${temp}°C - khá lạnh! Bạn nên mặc ấm, đặc biệt chú ý giữ ấm tay chân và cổ.`;
      } else {
        return `Nhiệt độ hiện tại là ${temp}°C - rất dễ chịu! Thời tiết lý tưởng để ra ngoài.`;
      }
    }
    return "Tôi cần dữ liệu thời tiết hiện tại để trả lời chính xác. Hãy tìm kiếm một thành phố trước nhé!";
  }
  
  if (message.includes('mưa') || message.includes('dự báo')) {
    if (currentWeatherData) {
      const weather = weatherCodeToText(currentWeatherData.current_weather.weathercode);
      if (message.includes('mưa')) {
        if (weather.includes('Mưa')) {
          return `Hiện tại có ${weather.toLowerCase()}. Bạn nên mang theo ô hoặc áo mưa khi ra ngoài.`;
        } else {
          return `Hiện tại ${weather.toLowerCase()}, không có mưa. Bạn có thể yên tâm ra ngoài mà không cần ô.`;
        }
      }
      return `Dự báo hiện tại: ${weather}, nhiệt độ ${Math.round(currentWeatherData.current_weather.temperature)}°C.`;
    }
    return "Tôi cần dữ liệu thời tiết để đưa ra dự báo chính xác. Hãy tìm kiếm một thành phố trước nhé!";
  }
  
  if (message.includes('gió') || message.includes('tốc độ')) {
    if (currentWeatherData) {
      const windSpeed = currentWeatherData.current_weather.windspeed;
      if (windSpeed > 20) {
        return `Tốc độ gió hiện tại là ${windSpeed} km/h - khá mạnh! Cẩn thận khi đi xe máy và tránh các khu vực có cây cao.`;
      } else if (windSpeed > 10) {
        return `Tốc độ gió hiện tại là ${windSpeed} km/h - gió nhẹ, rất dễ chịu cho các hoạt động ngoài trời.`;
      } else {
        return `Tốc độ gió hiện tại là ${windSpeed} km/h - gió rất nhẹ, thời tiết lặng gió.`;
      }
    }
    return "Tôi cần dữ liệu thời tiết để cung cấp thông tin về gió. Hãy tìm kiếm một thành phố trước nhé!";
  }
  
  // Hoạt động và địa điểm vui chơi
  if (message.includes('đi đâu') || message.includes('chơi') || message.includes('hoạt động') || 
      message.includes('làm gì') || message.includes('nên đi') || message.includes('địa điểm')) {
    if (currentWeatherData) {
      const weather = weatherCodeToText(currentWeatherData.current_weather.weathercode);
      const temp = Math.round(currentWeatherData.current_weather.temperature);
      const windSpeed = currentWeatherData.current_weather.windspeed;
      
      return getActivityRecommendations(weather, temp, windSpeed);
    }
    return "Tôi cần dữ liệu thời tiết để đưa ra gợi ý hoạt động phù hợp. Hãy tìm kiếm một thành phố trước nhé!";
  }
  
  if (message.includes('khuyên') || message.includes('nên') || message.includes('cần')) {
    if (currentWeatherData) {
      const weather = weatherCodeToText(currentWeatherData.current_weather.weathercode);
      const temp = Math.round(currentWeatherData.current_weather.temperature);
      
      let advice = `Dựa trên thời tiết hiện tại (${weather}, ${temp}°C): `;
      
      if (weather.includes('Mưa')) {
        advice += "Mang theo ô hoặc áo mưa, đi giày chống nước.";
      } else if (weather.includes('Nắng') || temp > 28) {
        advice += "Mặc quần áo mỏng, đội mũ, bôi kem chống nắng, uống nhiều nước.";
      } else if (temp < 18) {
        advice += "Mặc ấm, đặc biệt chú ý giữ ấm tay chân và cổ.";
      } else {
        advice += "Thời tiết dễ chịu, mặc quần áo thoải mái.";
      }
      
      return advice;
    }
    return "Tôi cần dữ liệu thời tiết để đưa ra lời khuyên phù hợp. Hãy tìm kiếm một thành phố trước nhé!";
  }
  
  if (message.includes('chào') || message.includes('hello') || message.includes('xin chào')) {
    return "Xin chào! Tôi là AI Assistant chuyên về thời tiết. Bạn có thể hỏi tôi về nhiệt độ, mưa, gió, hoặc xin lời khuyên về hoạt động vui chơi dựa trên thời tiết nhé!";
  }
  
  if (message.includes('cảm ơn') || message.includes('thanks')) {
    return "Không có gì! Tôi luôn sẵn sàng giúp bạn với các câu hỏi về thời tiết và hoạt động vui chơi. Có gì khác cần hỏi không?";
  }
  
  // Default response
  return "Tôi hiểu bạn đang hỏi về thời tiết. Bạn có thể hỏi cụ thể về nhiệt độ, mưa, gió, hoặc xin lời khuyên về hoạt động vui chơi. Tôi sẽ cố gắng trả lời dựa trên dữ liệu thời tiết hiện tại!";
}

// Hàm đưa ra gợi ý hoạt động dựa trên thời tiết
function getActivityRecommendations(weather, temp, windSpeed) {
  let recommendations = `Dựa trên thời tiết hiện tại (${weather}, ${temp}°C):\n\n`;
  
  // Hoạt động trong nhà
  if (weather.includes('Mưa') || weather.includes('Dông') || temp < 10) {
    recommendations += `🌧️ **Hoạt động trong nhà:**\n`;
    recommendations += `• Tham quan bảo tàng, phòng trưng bày nghệ thuật\n`;
    recommendations += `• Xem phim tại rạp chiếu phim\n`;
    recommendations += `• Tham quan trung tâm thương mại, shopping\n`;
    recommendations += `• Tham gia workshop, lớp học nấu ăn\n`;
    recommendations += `• Chơi game, đọc sách tại quán cà phê\n`;
    recommendations += `• Tham quan nhà hát, rạp hát\n\n`;
  }
  
  // Hoạt động ngoài trời
  if (!weather.includes('Mưa') && !weather.includes('Dông')) {
    recommendations += `☀️ **Hoạt động ngoài trời:**\n`;
    
    if (temp >= 25 && temp <= 35) {
      recommendations += `• Đi biển, bơi lội, lướt sóng\n`;
      recommendations += `• Tham quan công viên nước\n`;
      recommendations += `• Đi picnic tại công viên có bóng mát\n`;
      recommendations += `• Tham quan vườn thú, safari\n`;
      recommendations += `• Đi xe đạp dọc bờ sông, hồ\n`;
    } else if (temp >= 15 && temp < 25) {
      recommendations += `• Đi bộ đường dài, trekking\n`;
      recommendations += `• Tham quan vườn bách thảo, công viên\n`;
      recommendations += `• Đi xe đạp, chạy bộ\n`;
      recommendations += `• Tham quan di tích lịch sử ngoài trời\n`;
      recommendations += `• Chụp ảnh tại các điểm check-in\n`;
    } else if (temp < 15) {
      recommendations += `• Tham quan phố cổ, khu phố cũ\n`;
      recommendations += `• Đi dạo trong trung tâm thành phố\n`;
      recommendations += `• Tham quan chợ đêm, khu ẩm thực\n`;
      recommendations += `• Tham quan các công trình kiến trúc\n`;
    }
    
    // Gợi ý dựa trên tốc độ gió
    if (windSpeed > 15) {
      recommendations += `\n💨 **Lưu ý:** Gió khá mạnh, nên tránh các hoạt động trên cao như leo núi, cắm trại.\n`;
    } else if (windSpeed < 5) {
      recommendations += `\n🌤️ **Lưu ý:** Gió nhẹ, thời tiết lý tưởng cho các hoạt động ngoài trời.\n`;
    }
  }
  
  // Gợi ý đặc biệt theo thời tiết
  if (weather.includes('Trời quang') || weather.includes('Ít mây')) {
    recommendations += `\n✨ **Gợi ý đặc biệt:**\n`;
    recommendations += `• Tham quan đài quan sát, tòa nhà cao tầng\n`;
    recommendations += `• Chụp ảnh hoàng hôn, bình minh\n`;
    recommendations += `• Tham quan vườn hoa, khu vườn Nhật Bản\n`;
    recommendations += `• Đi thuyền, du thuyền trên sông/hồ\n`;
  }
  
  if (weather.includes('Nhiều mây') || weather.includes('Có mây')) {
    recommendations += `\n☁️ **Gợi ý đặc biệt:**\n`;
    recommendations += `• Tham quan các điểm du lịch văn hóa\n`;
    recommendations += `• Đi chợ địa phương, thử ẩm thực\n`;
    recommendations += `• Tham quan làng nghề truyền thống\n`;
    recommendations += `• Tham gia tour ẩm thực đường phố\n`;
  }
  
  // Gợi ý thời gian
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 6 && hour < 10) {
    recommendations += `\n🌅 **Buổi sáng sớm:** Thời gian lý tưởng để tập thể dục, đi bộ, tham quan công viên.`;
  } else if (hour >= 10 && hour < 14) {
    recommendations += `\n☀️ **Giữa trưa:** Nên chọn hoạt động trong nhà hoặc nơi có bóng mát.`;
  } else if (hour >= 14 && hour < 18) {
    recommendations += `\n🌤️ **Chiều:** Thời gian tốt cho các hoạt động ngoài trời.`;
  } else {
    recommendations += `\n🌙 **Tối:** Tham quan phố đêm, chợ đêm, nhà hàng, quán bar.`;
  }
  
  return recommendations;
}

// Update current weather data when weather is fetched
const originalGetWeather = getWeather;
getWeather = async function(lat, lon, city, country) {
  await originalGetWeather(lat, lon, city, country);
  
  // Store current weather data for chatbot
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const res = await fetch(url);
    if (res.ok) {
      currentWeatherData = await res.json();
    }
  } catch (err) {
    console.error('Error fetching weather data for chatbot:', err);
  }
};