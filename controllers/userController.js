const Client = require('../models/Client');
const Category = require('../models/Category');
const Catalog = require('../models/Catalog');
const Business = require('../models/Business');
const Prize = require('../models/Prize');
const passport = require('passport');
const crypto = require('crypto');
const paginate = require('handlebars-paginate');

const enviarEmail = require('../handlers/email');
const emailPassword = require('../handlers/emailReset');

const cloudinary = require('../config/cloudinary');
const fs = require('fs-extra');

const mostrarLogin = (req,res) => {
  res.render('user/auth.hbs',{
    layout: 'user.hbs',
    Session: false
  })
}

const mostrarRegistrarCliente = (req,res) => {
  res.render('user/registro.hbs',{
    layout: 'user.hbs',
    Session: false
  })
}

const mostrarCuentaUsuario = (req,res) => {
  console.log(req.user)
  const isMale = req.user.sexo == 'M' ? true : false;
  res.render('user/listar-usuario.hbs',{
    layout: 'user.hbs',
    user : {
      name : req.user.name,
      lastname : req.user.lastName,
      sexo: req.user.sexo,
      email: req.user.email,
      dni: req.user.dni,
      empresas: req.user.puntuacion.length,
      image: req.user.image,
      isMale
    },
    Session: true,
    name: req.user.name
  })
}
// verificar si el cliente esta esta autenticado
const clienteAutenticado = (req,res,next) => {

  if(req.isAuthenticated()){
    return next();
  }
  return res.redirect('/login');
}
const autenticarClliente = passport.authenticate('localCliente',{
  successRedirect: '/business',
  failureRedirect: '/login',
  failureFlash: true,
  badRequestMessage: 'Ambos compos son obligatorios'
})

const mostrarListadoEmpresas = async(req,res) => {

  //  cargar las empresas asosciadas
  req.session.afiliadas = await actualizarEmpresasAfiliadas(req);
  console.log(req.session.afiliadas);
  res.render('user/listar-empresas.hbs',{
    layout: 'user.hbs',
    empresas: req.session.afiliadas,
    name : req.user.name,
    Session: true
  })
}

const mostrarCatalogoEmpresa = async (req,res) => {
  console.log("mostrar empresa");
  const categorias = await obtenerCategorias(req.params.id);
  const catalogo = await Catalog.findOne({business: req.params.id});
  // premios por pagina
  let premio = 6;
  let paginaActual = req.query.p || 1;

  const filtroPuntos = req.query.puntos || false;

  // condicionar la busqueda de premiosTotales
  let premios;
  let premiosTotales;
  if (filtroPuntos){
     premios = await Prize.find({catalog: catalogo._id, points: {$gte: 0, $lte: filtroPuntos}})
    .skip((premio * paginaActual) - premio)
    .limit(premio).sort('points').lean();
  
    premiosTotales = await Prize.count({catalog: catalogo._id, points: {$gte: 0, $lte: filtroPuntos}});
  }else{
    premios = await Prize.find({catalog: catalogo._id})
    .skip((premio * paginaActual) - premio)
    .limit(premio).sort('points').lean();

    premiosTotales = await Prize.count({catalog: catalogo._id});
  }

  const paginasTotales = Math.ceil(premiosTotales / premio);

  // obtener datos de la empresa actual
  //  cargar las empresas asosciadas
  req.session.afiliadas = await actualizarEmpresasAfiliadas(req);
  let empresaActual;
  for (let empresa of req.session.afiliadas) {
    if(req.params.id == empresa.id){
      empresaActual = empresa;
    }
  }
  // console.log("passss");
  // console.log(premiosTotales);
  // return;
  res.render('user/listar-catalogo.hbs',{
    layout: 'user.hbs',
    categorias,
    premios,
    pagination: {
      page: paginaActual,       // The current page the user is on
      pageCount: paginasTotales,  // The total number of available pages
      parmPuntos: filtroPuntos
    },
    empresa: empresaActual,
    name : req.user.name,
    Session: true,
    filtroPuntos
  })
}

const mostrarCategoriaCatalogo = async (req,res) => {
  const categorias = await obtenerCategorias(req.params.id);
  const catalogo = await Catalog.findOne({business: req.params.id});
  const category = await Category.findOne({name: req.params.category});

  // premios por pagina
  let premio = 6;
  let paginaActual = req.query.p || 1;

  const filtroPuntos = req.query.puntos || false;
  // condicionar la busqueda de premiosTotales
  let premios;
  let premiosTotales;
  if(filtroPuntos){
    premios = await Prize.find({catalog: catalogo._id, category: category._id, points: {$gte: 0, $lte: filtroPuntos}})
    .skip((premio * paginaActual) - premio)
    .limit(premio).sort('points').lean();
    console.log(premios)
    premiosTotales = await Prize.count({catalog: catalogo._id,category: category._id, points: {$gte: 0, $lte: filtroPuntos}});
  }else{
    premios = await Prize.find({catalog: catalogo._id, category: category._id})
    .skip((premio * paginaActual) - premio)
    .limit(premio).sort('points').lean();
    console.log(premios)
    premiosTotales = await Prize.count({catalog: catalogo._id,category: category._id});
  }


  const paginasTotales = Math.ceil(premiosTotales / premio);

  // obtener datos de la empresa actual
  //  cargar las empresas asosciadas
  req.session.afiliadas = await actualizarEmpresasAfiliadas(req);
  let empresaActual;
  for (let empresa of req.session.afiliadas) {
    if(req.params.id == empresa.id){
      empresaActual = empresa;
    }
  }

  res.render('user/listar-catalogo-categoria.hbs',{
    layout: 'user.hbs',
    categorias,
    premios,
    pagination: {
      page: paginaActual,       // The current page the user is on
      pageCount: paginasTotales,  // The total number of available pages
      parmPuntos: filtroPuntos
    },
    empresa: empresaActual,
    name : req.user.name,
    Session: true,
    filtroPuntos
  })
}

const mostrarPremiosCanjeados = async (req,res) => {
  const premios = req.user.premios;
  // console.log(premios)
  const premiosData = [];
  for (const premio of premios) {
    const prize = await Prize.findById(premio.idPremio).populate('category');
    const business = await Business.findById(premio.idBusiness);
    const fecha = `${premio.date.getDate()}/${premio.date.getMonth()+1}/${premio.date.getFullYear()}`;
    const premioInfo = {
      name: prize.name,
      url: prize.url,
      points: prize.points,
      price: prize.price,
      category: prize.category.name,
      business: business.nombreComercial !== "-" ? business.nombreComercial : business.razonSocial,
      fecha
    }
    premiosData.push(premioInfo);
  }

  console.log(premiosData)
  res.render('user/listar-premios-canjeados.hbs',{
    layout: 'user.hbs',
    premiosData,
    name : req.user.name,
    Session: true
  })
}

const registrarCliente = async (req,res) => {
  const {dni,email,password,sexo} = req.body;
  // validar si ya existe el cliente 
  console.log(req.body)
  let cliente = await Client.findOne({email: email});

  if(cliente){
    return res.status(400).json({
      ok: false,
      msg: "El correo ya se encuentra registrado"
    });
  }

  // registrar o activar cuenta
  cliente = await Client.findOne({dni: dni});
  
  if(cliente){
    // activar cuenta / actualizar datos
    cliente.email = email;
    cliente.password = password;
    cliente.sexo = sexo;
    cliente.estado = true;
    await cliente.save();

    return res.json({
      ok: true,
      cliente,
      msg: "Cliente actualizado"
    })
  }

  // registrar nuevo clientes

  cliente = new Client(req.body);
  cliente.estado = true;
  await cliente.save().catch((error) => {
    return res.status(400).json({
      ok: false,
      error
    });
  });

  res.json({
    ok: true,
    cliente,
    msg: "Cliente registrado"
  })
}

const obtenerCategorias = async (idBusiness) => {
  const catalogo = await Catalog.findOne({business: idBusiness});
  const premios = await Prize.find({catalog: catalogo._id});

  let categorias = []
  let categories = new Set();

  for (let premio of premios) {
    const category = await Category.findById(premio.category);
    categories.add(category.name)
  }

  categories = Array.from(categories).sort();
  for (let category of categories) {
    let data;
     data = {
      name: category,
      empresa: idBusiness,
      catalogo: catalogo._id
    }
    categorias.push(data);
  }

  return categorias;
}

const canjearPremio = async (req,res) => {
  const id = req.params.id;
  const idEmpresa = req.body.empresa;
  const empresa = await Business.findById(idEmpresa);
  const prize = await Prize.findById(id).populate('category');
  const client = await Client.findById(req.user._id);

  let msg,state;
  for (let index = 0; index < client.puntuacion.length; index++) {
    const puntos = client.puntuacion[index];
    if(JSON.stringify(puntos.idBusiness) == JSON.stringify(idEmpresa)){
      if(puntos.puntos >= prize.points){
        msg = "Se canjeo el premio con exito";
        state = true;
        client.puntuacion[index].puntos -= prize.points; 
      }else{
        msg = "No cuenta con puntos necesarios";
        state = false;
      }
    }
  }
  
  if (state){
    // guardar el canje de puntos
    const premioCanjeado = {
      idBusiness: idEmpresa,
      idPremio: id
    };

    client.premios.push(premioCanjeado);
    await client.save();
    console.log(prize);
    // enviar notificacion por email
    await enviarEmail.enviar({
      usuario : req.user,
      subject: "Confirmar Premio",
      resetUrl: "hola mundo",
      archivo: 'confirmar-premio',
      nombre: prize.name,
      url: prize.url,
      points: prize.points,
      price: prize.price,
      description: prize.description,
      category: prize.category.name,
      business: empresa.nombreComercial !== "-" ? empresa.nombreComercial : empresa.razonSocial,
    })
  }

  res.json({
    ok: state,
    msg
  })

}
const premiosPaginas = async (req,res) => {
  let premio = 6;
  let paginaActual = req.params.page || 1;
  console.log(req.url)
  const premios = await Prize.find({})
    .skip((premio * paginaActual) - premio)
    .limit(premio);
  console.log(premios);
  res.json({
    ok: true,
    premios
  })
}

const registrarAvatar = async (req,res) => {
  const id = req.user._id;

  const client = await Client.findById(id).catch((err) => {
    return res.status(400).json({
      ok: false,
      err
    });
  })

  if(!client) return res.status(400).json({
    ok: false,
    err: {
      msg: "El cliente no existe o no tiene permisos"
    }
  });

  if(req.file){
    const result = await cloudinary.v2.uploader.upload(req.file.path);
    client.image = result.secure_url;
    await fs.unlink(req.file.path);
    console.log(req.file)
  }

  try {
    await client.save();
  } catch (err) {
    return res.status(400).json({
      ok: false,
      err: {
        msg: "No se pudo guardar la imagen"
      }
    }); 
  }

  res.json({
    ok: true,
    client
  });
}

const actualizarEmpresasAfiliadas = async(req) => {
  let empresas = []
  for (let puntuacion of req.user.puntuacion) {
    const empresa = await Business.findById(puntuacion.idBusiness);
    const data = {
      id: empresa._id,
      nombre : empresa.nombreComercial !== "-" ? empresa.nombreComercial : empresa.razonSocial,
      puntos : puntuacion.puntos
    }
    empresas.push(data);
  }

  return empresas;
}

const mostrarReestablecerPassword = (req,res) => {
  const token = crypto.randomBytes(20).toString('hex');
  console.log(token)
  res.render('user/reestablecer-password.hbs',{
    layout: 'user.hbs',
    Session: false
  })
}

const enviarToken = async (req,res) => {
  console.log("hola token")
  const usuario = await Client.findOne({email: req.body.email});
  if(!usuario){
    req.flash('error','No existe esa cuenta');
    res.redirect('/login');
    return;
  }
  usuario.token = crypto.randomBytes(20).toString('hex');
  usuario.expira = Date.now() + 3600000;
  await usuario.save();
  const resetUrl = `https://${req.headers.host}/reestablecer-password/${usuario.token}`;
  console.log(resetUrl);
  // enviar notificacion por email
  await emailPassword.enviar({
    usuario,
    subject: "Password Reset",
    resetUrl,
    archivo: 'reset'
  })

  req.flash('correcto', 'Revisa tu email para las indicaciones');
  res.redirect('/login');
}

const reestablecerPassword = async(req,res) =>{
  const usuario = await Client.findOne({
    token: req.params.token,
    expira: {
      $gt: Date.now()
    }
  });

  if(!usuario) {
    req.flash('error', 'El formulario ya no es valido, intente de nuevo');
    return res.redirect('/reestablecer-password');
  }

  // mostrar formulario
  res.render('user/nuevo-password.hbs',{
    layout: 'user.hbs',
    Session: false
  })
}

const guardarPassword = async(req,res) => {
  const usuario = await Client.findOne({
    token: req.params.token,
    expira: {
      $gt: Date.now()
    }
  });

  if(!usuario) {
    req.flash('error', 'El formulario ya no es valido, intente de nuevo');
    return res.redirect('/reestablecer-password');
  }

  usuario.password = req.body.password;
  usuario.token = undefined;
  usuario.expira = undefined;

  await usuario.save();

  req.flash('correcto','Password Modificado Correctamente');
  res.redirect('/login');
}

const cerrarSesion = (req,res) => {
  req.logout();
  res.redirect('/login');
}

module.exports = {
  mostrarLogin,
  mostrarRegistrarCliente,
  mostrarCuentaUsuario,
  mostrarPremiosCanjeados,
  autenticarClliente,
  clienteAutenticado,
  mostrarListadoEmpresas,
  mostrarCatalogoEmpresa,
  mostrarCategoriaCatalogo,
  registrarCliente,
  canjearPremio,
  registrarAvatar,
  premiosPaginas,
  mostrarReestablecerPassword,
  enviarToken,
  reestablecerPassword,
  guardarPassword,
  cerrarSesion
}

