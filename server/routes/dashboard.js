import express from 'express';
import { authenticateUser } from '../auth-middleware.js';
import { supabaseAdmin } from '../supabase-admin.js';

const router = express.Router();

router.get('/complete', authenticateUser, async (req, res) => {
  try {
    const { query } = req;
    const selectedRadios = Array.isArray(query.radio) ? query.radio : query.radio ? [query.radio] : [];

    if (!selectedRadios.length) {
      return res.status(400).json({ error: 'Nenhuma rádio selecionada' });
    }

    // Buscar status das rádios e dados do dashboard em paralelo
    const [radiosStatusResult, dashboardDataResponse] = await Promise.all([
      supabaseAdmin
        .from('streams')
        .select('name')
        .in('name', selectedRadios),
      supabaseAdmin
        .rpc('get_dashboard_data', {
          p_radios: selectedRadios,
          p_start_date: new Date().toISOString().split('T')[0],
          p_end_date: new Date().toISOString().split('T')[0]
        })
    ]);

    if (radiosStatusResult.error) {
      throw new Error('Falha ao buscar status das rádios');
    }

    // Verificar se temos dados do dashboard antes de prosseguir
    if (dashboardDataResponse.error) {
      throw new Error('Falha ao buscar dados do dashboard');
    }

    const [radiosStatus, dashboardData] = [
      radiosStatusResult.data,
      dashboardDataResponse.data
    ];

    // Processar e combinar os dados
    const response = {
      radiosStatus: radiosStatus.map(radio => ({
        name: radio.name,
        status: 'ONLINE' // Status padrão como ONLINE já que não temos a coluna status
      })),
      topSongs: dashboardData?.top_songs || [],
      artistData: dashboardData?.artist_data || [],
      genreData: dashboardData?.genre_data || [],
      totalSongs: dashboardData?.total_songs || 0,
      songsPlayedToday: dashboardData?.songs_played_today || 0
    };

    res.json(response);
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({
      error: 'Erro ao carregar dados do dashboard',
      details: error.message
    });
  }
});

export default router;