const errorVisible = new URLSearchParams(window.location.search).has("error");
const errorMessage = document.querySelector("[data-login-error]");

if (errorVisible && errorMessage) {
  errorMessage.hidden = false;
}
