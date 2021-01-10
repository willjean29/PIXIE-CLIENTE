const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');
const util = require('util');
let transport = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
      user: 'puntospixie@gmail.com',
      pass: 'Pixie123@'
  }
});

// utilizar templates de hbs
transport.use('compile', hbs({
  viewEngine: {
    viewEngine: 'hbs',
    partialsDir: __dirname+'/../views/emails',
    layoutsDir: __dirname+'/../views/emails',
    defaultLayout: 'reset.hbs',
  },
  viewPath: __dirname+'/../views/emails',
  extName: '.hbs'
}));

const enviar = async(opciones) => {
  const opcionesEmail = {
    from: "Pixie Account <no-reply@pixie.com>",
    to: opciones.usuario.email,
    subject: opciones.subject,
    template: opciones.archivo,
    context: {
      resetUrl: opciones.resetUrl
    }
  }

  const sendEmail = util.promisify(transport.sendMail,transport);
  return sendEmail.call(transport, opcionesEmail);
}

module.exports = {
  enviar
}
