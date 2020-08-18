const Logger = require('../config/loggerService');
const logger = new Logger('app');
const microprofiler = require('microprofiler');
const File = require('../models/File');
const Business = require('../models/Business');
const Competition = require('../models/Competition');
const Client = require('../models/Client');
const {leerCSV} = require('../utils/leerCSV');
const {puntosSoles} = require('../utils/points');

const registrarArchivo = async(req,res) => {
  let start = microprofiler.start();
  let file;
  const id = req.user._id;
  const business = await Business.findOne({administrador: id}).catch((err) => {
    logger.error('Error en database',err)
    return res.status(400).json({
      ok: false,
      err
    })
  });

  if(!business) return res.status(400).json({
    ok: false,
    err: {
      msg: "La empresa no se encuentra registrada"
    }
  })

  if(req.file){
    file = new File({
      name: req.file.filename,
      type: req.file.mimetype,
      business: business._id
    })

    await file.save();
  }

  res.json({
    ok: true,
    file
  })
  let elapsedUs = microprofiler.measureFrom(start,'code');
  let stats = microprofiler.getStats('code');
  logger.debug('Procesar request registrarArchivo',stats)
}

const obtenerDatosArchivo = async(req,res) => {
  let start = microprofiler.start();
  const id = req.params.id;
  const file = await File.findById(id).catch((err) => {
    return res.status(400).json({
      ok: false,
      err
    })
  })

  if(!file) return res.status(400).json({
    ok: false,
    err: {
      msg: "Archivo no registrado"
    }
  })

  const datos = leerCSV(file.name);

  res.render('admin/listar-file-detalles',{
    datos
  })
  let elapsedUs = microprofiler.measureFrom(start,'code');
  let stats = microprofiler.getStats('code');
  logger.debug('Procesar request obtenerDatosArchivo',stats)
}

const cargarDataCliente = async (req,res) => {
  let start = microprofiler.start();
  const id = req.params.id;

  const file = await File.findById(id).catch((err) => {
    return res.status(400).json({
      ok: false,
      err
    })
  })

  if(!file) return res.status(400).json({
    ok: false,
    err: {
      msg: "Archivo no registrado"
    }
  })

  const datos = leerCSV(file.name);

  const business = await Business.findById(file.business);

  const competition = await Competition.findOne({business: business._id});
  const {parametro, puntos} = competition.reglas;

  datos.forEach(async(data,index) => {
    // buscar cliente
    let client = await Client.findOne({dni: data.DNI});
    // calcular los puntos pore operacion
    let puntosGanados = puntosSoles(parametro,puntos,data.Total_Venta);

    // cliente no registrado
    if(!client){
      console.log("cliente nuevo ",index)
      client = new Client({
        dni: data.DNI,
        name: data.Nombres,
        lastName: data.Apellidos
      })
      let puntuacion = {
        idBusiness: business._id,
        puntos: puntosGanados
      }

      client.puntuacion.push(puntuacion);
      await client.save();
    }else{
      let existeCliente = false;
      // cliente registrado , pero nuevo en la empresa
      // cliente registrado, parte de le empresa 
      client.puntuacion.forEach((info) => {
        // actualizamos el puntaje de la empresa actual 
        if(JSON.stringify(info.idBusiness) === JSON.stringify(business._id)){
          existeCliente = true;
          info.puntos += puntosGanados;
        }
      })

      if(!existeCliente){
        let puntuacion = {
          idBusiness: business._id,
          puntos: puntosGanados
        }
        client.puntuacion.push(puntuacion);
      }

      await client.save();
    }
  })

  file.estado = true;
  await file.save();
  await actualizarClientes(business._id);
  res.json({
    ok: true,
    msg: "Puntajes Cargados"
  })

  let elapsedUs = microprofiler.measureFrom(start,'code');
  let stats = microprofiler.getStats('code');
  logger.debug('Procesar request cargarDataCliente',stats)
}

const actualizarClientes = async(id) => {
  const business = await Business.findById(id);
  const clients = await Client.find();
  clients.forEach((client) => {
    client.puntuacion.forEach((info) => {
      if(JSON.stringify(info.idBusiness) === JSON.stringify(business.id)){
        let clientes = {
          idCliente: client.id
        }
        business.clientes.push(clientes);
      }
    })
  })

  await business.save();
}
module.exports = {
  registrarArchivo,
  obtenerDatosArchivo,
  cargarDataCliente
}