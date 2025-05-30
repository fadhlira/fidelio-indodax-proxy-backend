const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000; // Server akan berjalan di port 5000 secara default

// Aktifkan CORS untuk mengizinkan aplikasi React Anda berkomunikasi
// PENTING: Ganti 'http://localhost:3000' dengan URL spesifik aplikasi React Anda
// Jika Anda menjalankan aplikasi React di lingkungan Canvas, URL-nya akan terlihat seperti:
// 'https://<random_string>.scf.usercontent.goog' atau 'https://<random_string>.web.app'
// Anda bisa coba 'http://localhost:3000' untuk pengembangan lokal React di masa depan,
// atau gunakan '*' untuk mengizinkan semua origin (TIDAK disarankan untuk produksi).
app.use(cors({ origin: 'http://localhost:3000' })); // <<< UBAH INI JIKA URL REACT APP ANDA BEDA
app.use(express.json());

// --- Indodax Public API Base URL ---
const INDODAX_PUBLIC_API_URL = 'https://indodax.com/api';
const INDODAX_CHARTS_API_URL = 'https://indodax.com/api/charts';

// Helper untuk mapping interval Binance ke Indodax Chart API
// Indodax Chart API menggunakan menit sebagai timeframe (15, 60, 240)
const INDODAX_CHART_TIMEFRAME_MAP = {
    '15m': '15',
    '1h': '60',
    '4h': '240',
    // Tambahkan mapping jika ada lebih banyak timeframe di Indodax API
};

// --- Endpoint untuk Ticker 24 Jam (menggunakan /webdata Indodax) ---
// Endpoint ini mengambil ringkasan data pasar yang seringkali cukup untuk Fase 1.
app.get('/api/indodax/ticker', async (req, res) => {
    try {
        const response = await axios.get(`${INDODAX_PUBLIC_API_URL}/webdata`);
        const indodaxWebData = response.data;

        const formattedTickers = [];
        // !!! PENGECEKAN BARU DI SINI UNTUK MENCEGAH UNDEFINED !!!
        if (indodaxWebData && indodaxWebData.pairs) { 
            // Daftar pasangan yang umum dan relevan di Indodax (Anda bisa sesuaikan)
            const relevantPairs = [
                'btcidr', 'ethidr', 'bnbidr', 'solanaidr', 'xpridr', 'dogeidr', 
                'trxidr', 'ltcidr', 'adaidr', 'dotidr', 'maticidr', 'avaxidr',
                // Tambahkan pasangan lain yang Anda inginkan dari Indodax
            ]; 
            
            for (const pairKey of relevantPairs) {
                if (indodaxWebData.pairs[pairKey]) {
                    const pairData = indodaxWebData.pairs[pairKey];
                    // Konversi nama pair Indodax (btcidr) ke format frontend (BTCUSDT)
                    // Ini adalah simulasi, karena di Indodax tidak ada pasangan USDT
                    const simulatedSymbolForFrontend = pairKey.toUpperCase().replace('IDR', 'USDT'); 

                    formattedTickers.push({
                        symbol: simulatedSymbolForFrontend, 
                        lastPrice: parseFloat(pairData.last_price), // Harga dalam IDR
                        priceChangePercent: parseFloat(pairData.percent_change),
                        quoteVolume: parseFloat(pairData.volume_idr) // Volume dalam IDR
                    });
                }
            }
        }
        res.json(formattedTickers);
    } catch (error) {
        console.error('Error fetching Indodax ticker:', error.message);
        res.status(500).json({ error: 'Failed to fetch Indodax ticker data' });
    }
});

// --- Endpoint untuk Data Candlestick (Klines) ---
// Frontend akan meminta symbol (misal BTCUSDT) dan interval (15m, 1h, 4h)
app.get('/api/indodax/klines', async (req, res) => {
    const { symbol, interval, limit } = req.query; 
    const indodaxInterval = INDODAX_CHART_TIMEFRAME_MAP[interval];
    // Konversi simbol dari format frontend (BTCUSDT) ke format Indodax (btcidr)
    const indodaxPair = symbol.toLowerCase().replace('usdt', 'idr'); 

    if (!indodaxInterval || !indodaxPair) {
        return res.status(400).json({ error: 'Invalid symbol or interval' });
    }

    try {
        const response = await axios.get(`${INDODAX_CHARTS_API_URL}/${indodaxPair}/${indodaxInterval}/data`);
        const indodaxKlines = response.data.data; 

        if (!indodaxKlines || indodaxKlines.length === 0) {
            return res.json([]);
        }

        const formattedKlines = indodaxKlines.map(d => ({
            openTime: new Date(d.time * 1000), 
            open: parseFloat(d.open),
            high: parseFloat(d.high),
            low: parseFloat(d.low),
            close: parseFloat(d.close),
            volume: parseFloat(d.volume)
        })).slice(-limit); 

        res.json(formattedKlines);
    } catch (error) {
        console.error(`Error fetching Indodax klines for ${symbol} - ${interval}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch Indodax klines data' });
    }
});

// --- Endpoint untuk Harga Tunggal ---
// Frontend akan meminta symbol (misal BTCUSDT)
app.get('/api/indodax/price', async (req, res) => {
    const { symbol } = req.query;
    // Konversi simbol dari format frontend (BTCUSDT) ke format Indodax (btcidr)
    const indodaxPair = symbol.toLowerCase().replace('usdt', 'idr');

    try {
        const response = await axios.get(`${INDODAX_PUBLIC_API_URL}/ticker/${indodaxPair}`);
        const priceData = response.data.ticker; // Asumsi struktur data ticker Indodax
        
        if (priceData && priceData.last) { 
            res.json({ price: parseFloat(priceData.last) }); // Mengembalikan harga dalam IDR
        } else {
            res.status(404).json({ error: `Price not found for symbol ${symbol}` });
        }
    } catch (error) {
        console.error(`Error fetching Indodax price for ${symbol}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch Indodax price' });
    }
});


// Mulai server backend
app.listen(PORT, () => {
    console.log(`Indodax Proxy Backend running on http://localhost:${PORT}`);
});
