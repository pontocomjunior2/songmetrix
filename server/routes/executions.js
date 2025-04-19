import express from 'express';
import { authenticateBasicUser } from '../auth-middleware.js';
import supabaseAdmin from '../supabase-admin.js';

const router = express.Router();

router.get('/', authenticateBasicUser, async (req, res) => {
  try {
    const { page = 0, limit = 1000, start_date, end_date, start_time, end_time } = req.query;

    if (!start_date || !end_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required date/time parameters' });
    }

    // Combine date and time for start and end
    const startDateTime = `${start_date}T${start_time}`;
    const endDateTime = `${end_date}T${end_time}`;

    // Query executions from Supabase
    const { data, error } = await supabaseAdmin
      .from('executions')
      .select('*')
      .gte('execution_time', startDateTime)
      .lte('execution_time', endDateTime)
      .range(page * limit, (page + 1) * limit - 1)
      .order('execution_time', { ascending: false });

    if (error) {
      console.error('Error fetching executions:', error);
      throw new Error('Failed to fetch executions');
    }

    res.json(data);
  } catch (error) {
    console.error('Error in executions route:', error);
    res.status(500).json({
      error: 'Error loading executions data',
      details: error.message
    });
  }
});

export default router;