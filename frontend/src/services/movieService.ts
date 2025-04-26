import axios from 'axios';

export async function getMovies() {
  const res = await axios.get('http://localhost:3000/movie');
  return res.data;
}
