// Using Open-Meteo (free, no API key required)
const API_KEY = "";

document.getElementById("searchBtn").addEventListener("click", async () => {
  const city = document.getElementById("cityInput").value;
  if (!city) return alert("Vui lòng nhập tên thành phố!");

  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=vi&format=json`);
    if (!geoRes.ok) throw new Error(`Geo API lỗi: ${geoRes.status}`);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) return alert("Không tìm thấy thành phố!");
    const { latitude, longitude, name, country_code } = geoData.results[0];
    getWeather(latitude, longitude, name, country_code);
  } catch (err) {
    console.error(err);
    alert("Không thể gọi API vị trí. Kiểm tra kết nối mạng.");
  }
});

// Submit on Enter for better UX
document.getElementById("cityInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    document.getElementById("searchBtn").click();
  }
});

// Load Hà Nội by default on first load (bypass Geo to avoid 401)
window.addEventListener("DOMContentLoaded", () => {
  const defaultCity = { name: "Hà Nội", country: "VN", lat: 21.0278, lon: 105.8342 };
  getWeather(defaultCity.lat, defaultCity.lon, defaultCity.name, defaultCity.country);
});

// Autocomplete suggestions using Open-Meteo Geocoding
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
    return `
      <div class="card">
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
  const hourlyHTML = hourlyTimes.slice(0, 8).map((t, i) => {
    const time = new Date(t).getHours();
    return `
      <div class="card">
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
  } catch (err) {
    console.error(err);
    alert("Đã xảy ra lỗi khi tải dữ liệu thời tiết.");
  }
}

// Weather code to human text (Open-Meteo)
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
