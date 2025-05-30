const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000; // Server akan berjalan di port 5000 secara default

// Konfigurasi CORS
// <<< PENTING: UBAH INI! >>>
// Untuk debugging lokal dengan Create React App (default port 3000):
app.use(cors({ origin: 'http://localhost:3000' })); 
// Jika Anda menguji di lingkungan Canvas (seperti di Google Gemini), URL-nya dinamis:
// Anda bisa coba: app.use(cors({ origin: 'null' })); // Untuk origin 'blob:' di Canvas
// Atau, untuk debugging paling mudah (TAPI TIDAK AMAN UNTUK PRODUKSI):
// app.use(cors()); // Ini mengizinkan semua origin. JANGAN GUNAKAN DI PRODUKSI!

app.use(express.json());

// --- Indodax Public API Base URL ---
const INDODAX_PUBLIC_API_URL = 'https://indodax.com/api';
const INDODAX_CHARTS_API_URL = 'https://indodax.com/api/charts';

// Helper untuk mapping interval Frontend ke Indodax Chart API
const INDODAX_CHART_TIMEFRAME_MAP = {
    '15m': '15',
    '1h': '60',
    '4h': '240',
};

// --- Endpoint untuk Ticker 24 Jam (menggunakan /webdata Indodax) ---
// Akan mengembalikan daftar semua pasangan dengan detail ticker (harga, volume, %perubahan)
app.get('/api/indodax/ticker', async (req, res) => {
    try {
        const response = await axios.get(`${INDODAX_PUBLIC_API_URL}/webdata`);
        const indodaxWebData = response.data;

        const formattedTickers = [];
        if (indodaxWebData && indodaxWebData.pairs) { 
            // Ambil semua pasangan yang ada di 'pairs' objek
            for (const pairKey in indodaxWebData.pairs) {
                if (indodaxWebData.pairs.hasOwnProperty(pairKey)) {
                    const pairData = indodaxWebData.pairs[pairKey];
                    // Hanya proses pasangan IDR (misal: "btcidr")
                    if (pairKey.endsWith('idr')) {
                        // Konversi nama pair Indodax (misal btcidr) ke format frontend (BTCIDR)
                        const formattedSymbol = pairKey.toUpperCase().replace('_IDR', 'IDR'); 

                        formattedTickers.push({
                            symbol: formattedSymbol, 
                            lastPrice: parseFloat(pairData.last_price), // Harga dalam IDR
                            priceChangePercent: parseFloat(pairData.percent_change),
                            quoteVolume: parseFloat(pairData.volume_idr) // Volume dalam IDR
                        });
                    }
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
// Frontend akan meminta symbol (misal BTCIDR) dan interval (15m, 1h, 4h)
app.get('/api/indodax/klines', async (req, res) => {
    const { symbol, interval, limit } = req.query; 
    const indodaxInterval = INDODAX_CHART_TIMEFRAME_MAP[interval];
    // Konversi simbol dari format frontend (misal BTCIDR) ke format Indodax (btcidr)
    const indodaxPair = symbol.toLowerCase(); 

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
// Frontend akan meminta symbol (misal BTCIDR)
app.get('/api/indodax/price', async (req, res) => {
    const { symbol } = req.query;
    // Konversi simbol dari format frontend (misal BTCIDR) ke format Indodax (btcidr)
    const indodaxPair = symbol.toLowerCase();

    try {
        const response = await axios.get(`${INDODAX_PUBLIC_API_URL}/ticker/${indodaxPair}`);
        const priceData = response.data.ticker; 
        
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
