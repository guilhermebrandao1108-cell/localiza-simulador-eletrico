// O app usa módulos ES, que o navegador só carrega por http(s). Quem abre o
// index.html direto do disco vê esta orientação em vez de uma tela vazia.
if (location.protocol === 'file:') {
  document.getElementById('screen').innerHTML =
    '<div class="error"><strong>Abra por um servidor local.</strong><br>Na pasta do projeto, rode <code>python3 -m http.server 8000</code> e acesse <code>http://localhost:8000</code>.</div>';
}
