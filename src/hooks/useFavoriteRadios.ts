import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const useFavoriteRadios = () => {
  const { currentUser } = useAuth();
  const [favoriteRadios, setFavoriteRadios] = useState<string[]>([]);
  const [availableRadios, setAvailableRadios] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavoriteRadios = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFavoriteRadios(data.favoriteRadios || []);
      } else {
        setFavoriteRadios([]);
      }
    } catch (error) {
      console.error('Erro ao buscar rádios favoritas:', error);
      setError('Não foi possível carregar suas rádios favoritas');
    }
  };

  const fetchAvailableRadios = async () => {
    try {
      const radiosRef = collection(db, 'radios');
      const snapshot = await getDocs(radiosRef);
      const radiosList = snapshot.docs.map(doc => doc.data().name);
      setAvailableRadios(radiosList);
    } catch (error) {
      console.error('Erro ao buscar rádios disponíveis:', error);
      setError('Não foi possível carregar a lista de rádios');
    }
  };

  const saveFavoriteRadios = async (radios: string[]) => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const userRef = doc(db, 'users', currentUser.uid);
      
      await updateDoc(userRef, {
        favoriteRadios: radios,
        updatedAt: new Date().toISOString()
      });

      setFavoriteRadios(radios);
      return true;
    } catch (error) {
      console.error('Erro ao salvar rádios favoritas:', error);
      setError('Não foi possível salvar suas rádios favoritas');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const hasFavorites = async (): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return Array.isArray(data.favoriteRadios) && data.favoriteRadios.length > 0;
      }
      return false;
    } catch (error) {
      console.error('Erro ao verificar rádios favoritas:', error);
      return false;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          fetchFavoriteRadios(),
          fetchAvailableRadios()
        ]);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setError('Ocorreu um erro ao carregar os dados');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  return {
    favoriteRadios,
    availableRadios,
    loading,
    error,
    saveFavoriteRadios,
    hasFavorites,
    refresh: async () => {
      await Promise.all([
        fetchFavoriteRadios(),
        fetchAvailableRadios()
      ]);
    }
  };
};
