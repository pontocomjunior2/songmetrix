import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

await redisClient.connect();

// Função para obter dados do cache
export const getCache = async (key) => {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
};

// Função para salvar dados no cache
export const setCache = async (key, data, ttl = 300) => {
  try {
    await redisClient.set(key, JSON.stringify(data), {
      EX: ttl // Tempo de expiração em segundos
    });
  } catch (error) {
    console.error('Error setting cache:', error);
  }
};

// Função para invalidar cache
export const invalidateCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
};

export default redisClient;
