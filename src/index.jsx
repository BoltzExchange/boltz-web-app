/* @refresh reload */
import { render } from 'solid-js/web';
import App from './App';

// rainbow mode
document.getElementById("toggle-rainbow").addEventListener("click", (e) => {
  if (document.body.classList.contains("rainbow")) {
    document.body.classList.remove("rainbow")
  } else {
    document.body.classList.add("rainbow")
  }
});

render(() => <App />, document.getElementById('root'));
