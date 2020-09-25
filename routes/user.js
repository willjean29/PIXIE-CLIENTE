const express = require('express');
const app = express.Router();
const {uploadImage} = require('../middlewares/uploadImage');
const userController = require('../controllers/userController');
app.get('/',(req,res) => {
  res.redirect('/login');
});

app.get('/login',userController.mostrarLogin);

app.post('/login',userController.autenticarClliente);

app.get('/registrer',userController.mostrarRegistrarCliente);

app.post('/registrer',userController.registrarCliente);

app.get('/account',userController.mostrarCuentaUsuario);

app.post('/account-avatar',uploadImage,userController.registrarAvatar);

app.get('/cerrar-sesion',userController.cerrarSesion);

app.get('/business',userController.mostrarListadoEmpresas);

app.get('/business/:id',userController.mostrarCatalogoEmpresa);

app.get('/business/:id/:category',userController.mostrarCategoriaCatalogo);

app.get('/products/:page',userController.premiosPaginas);

app.post('/prizes/:id',userController.canjearPremio);

app.get('/list-prizes',userController.mostrarPremiosCanjeados);

// enviar email para recuperar contraseña
app.get('/reestablecer-password',userController.mostrarReestablecerPassword);
app.post('/reestablecer-password',userController.enviarToken);

// guardar la nueva contraseña en DB_PIXIE
app.get('/reestablecer-password/:token',userController.reestablecerPassword);
app.post('/reestablecer-password/:token',userController.guardarPassword);

module.exports = app;

