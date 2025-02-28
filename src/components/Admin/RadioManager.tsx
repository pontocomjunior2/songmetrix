import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';

interface Radio {
  url: string;
  name: string;
  cidade: string;
  estado: string;
  regiao: string;
  segmento: string;
  index: string;
}

const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const API_URL = 'http://104.234.173.43:3030';
const API_KEY = import.meta.env.VITE_FINGER_API_KEY;


const RadioManager: React.FC = () => {
  const [radios, setRadios] = useState<Radio[]>([]);
  const [open, setOpen] = useState(false);
  const [editingRadio, setEditingRadio] = useState<Radio | null>(null);
  const [formData, setFormData] = useState<Radio>({
    url: '',
    name: '',
    cidade: '',
    estado: '',
    regiao: '',
    segmento: '',
    index: ''
  });

  useEffect(() => {
    fetchRadios();
  }, []);

  const fetchRadios = async () => {
    try {
      const response = await fetch(`${API_URL}/streams`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      const data = await response.json();
      setRadios(data);
    } catch (error) {
      console.error('Erro ao carregar rádios:', error);
    }
  };

  const handleOpen = (radio?: Radio) => {
    if (radio) {
      setEditingRadio(radio);
      setFormData(radio);
    } else {
      setEditingRadio(null);
      setFormData({
        url: '',
        name: '',
        cidade: '',
        estado: '',
        regiao: '',
        segmento: '',
        index: ''
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingRadio(null);
  };

  const handleSubmit = async () => {
    try {
      const method = editingRadio ? 'PUT' : 'POST';
      const url = editingRadio 
        ? `${API_URL}/streams/${editingRadio.index}`
        : `${API_URL}/streams`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        fetchRadios();
        handleClose();
      } else {
        console.error('Erro ao salvar rádio');
      }
    } catch (error) {
      console.error('Erro ao salvar rádio:', error);
    }
  };

  const handleDelete = async (index: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta rádio?')) {
      try {
        const response = await fetch(`${API_URL}/streams/${index}`, {
          method: 'DELETE',
          headers: {
            'x-api-key': API_KEY
          }
        });

        if (response.ok) {
          fetchRadios();
        } else {
          console.error('Erro ao excluir rádio');
        }
      } catch (error) {
        console.error('Erro ao excluir rádio:', error);
      }
    }
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Gerenciamento de Rádios</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Adicionar Rádio
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Cidade</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Região</TableCell>
              <TableCell>Segmento</TableCell>
              <TableCell>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {radios.map((radio) => (
              <TableRow key={radio.index}>
                <TableCell>{radio.name}</TableCell>
                <TableCell>{radio.url}</TableCell>
                <TableCell>{radio.cidade}</TableCell>
                <TableCell>{radio.estado}</TableCell>
                <TableCell>{radio.regiao}</TableCell>
                <TableCell>{radio.segmento}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(radio)} color="primary">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(radio.index)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRadio ? 'Editar Rádio' : 'Adicionar Nova Rádio'}
        </DialogTitle>
        <DialogContent>
          <Box display="grid" gap={2} pt={2}>
            <TextField
              fullWidth
              label="Nome da Rádio"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              fullWidth
              label="URL do Stream"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            />
            <TextField
              fullWidth
              label="Cidade"
              value={formData.cidade}
              onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Estado</InputLabel>
              <Select
                value={formData.estado}
                label="Estado"
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              >
                {ESTADOS.map((estado) => (
                  <MenuItem key={estado} value={estado}>
                    {estado}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Região</InputLabel>
              <Select
                value={formData.regiao}
                label="Região"
                onChange={(e) => setFormData({ ...formData, regiao: e.target.value })}
              >
                {REGIOES.map((regiao) => (
                  <MenuItem key={regiao} value={regiao}>
                    {regiao}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Segmento"
              value={formData.segmento}
              onChange={(e) => setFormData({ ...formData, segmento: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RadioManager;
