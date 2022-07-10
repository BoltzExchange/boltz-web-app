export const BOLTZ_API_URL = "https://boltz.exchange/api";

export const divider = 100000000;

export const startInterval = (cb) => {
  cb();
  return setInterval(cb, 10000);
};

export const focus = () => {
   document.getElementById('sendAmount').focus();
};

export const fetcher = (url, cb, opts = {}) => {
  fetch(BOLTZ_API_URL+url, opts)
    .then(response => {
      if (!response.ok) throw new Error(`Request failed with status ${reponse.status}`);
      return response.json();
    })
    .then(cb)
    .catch(error => console.error(error));
};

export default fetcher;
