const BOLTZ_API_URL = "https://boltz.exchange/api";
const fetcher = (url, cb) => {
  fetch(BOLTZ_API_URL+url)
    .then(response => {
      if (!response.ok) throw new Error(`Request failed with status ${reponse.status}`);
      return response.json();
    })
    .then(cb)
    .catch(error => console.error(error));
};

export default fetcher;
