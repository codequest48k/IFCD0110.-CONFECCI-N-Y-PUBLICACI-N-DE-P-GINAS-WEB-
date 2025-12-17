# Informe de Creación del Formulario de Inscripción a Clases
*Autor: Ruslan Komarytskiy*


## Controles que he utilizado en el formulario
Usé principalmente controles básicos de HTML. Estos son los que añadí:

### **Inputs de texto**
- Para **Nombre**, **Apellidos** y **Dirección**.

### **Fechas**
- Para la **fecha de nacimiento** y la **fecha de inicio de la clase** usando `input type="date"`.

### **Subida de archivo**
- Un campo `input type="file"` para permitir subir una foto de perfil.

### **Radio Buttons**
- Para seleccionar el género (Hombre o Mujer).

### **Checkboxes**
- Para elegir las clases a las que quiere asistir la persona: Matemáticas, Lengua, Historia y Geografía.

### **Select / Dropdown**
- Para seleccionar el **idioma**.
- Para seleccionar la **hora de inicio**.

### **Textarea**
- Para escribir **comentarios adicionales**.

### **Botones**
- Un botón **Reset** para borrar los datos.
- Un botón **Submit** para enviar el formulario.

---
## Propiedades que he asignado a los controles
Como estoy aprendiendo, intenté usar propiedades sencillas pero importantes:

- **required** → para que ciertos campos sean obligatorios.
- **placeholder** → para orientar al usuario.
- **accept="image/*"** → para que solo se acepten imágenes en la subida de archivo.
- **aria-required** → para accesibilidad.
- **id y name** → para identificar cada campo.

---
## Propiedades asignadas al formulario
Al formulario completo le asigné:

- **action="#"** porque aún no sé conectar el formulario con un servidor.
- **method="post"** porque se recomienda para enviar datos.
- **enctype="multipart/form-data"** porque permite enviar archivos (la foto de perfil).

---
## Usabilidad y accesibilidad aplicadas
Aunque soy principiante, intenté aplicar algunas buenas prácticas:

### **Usabilidad**
- Agrupé los datos dentro de **fieldset** para que todo quede organizado.
- Añadí **legend** para identificar cada sección.
- Utilicé una **cuadrícula responsiva** para que el diseño se adapte.
- Puse un **asterisco rojo** en los campos obligatorios.
- Los botones están bien separados y se diferencian claramente.

### **Accesibilidad**
- Añadí estilos de **foco** para que sea visible cuando se selecciona un campo.
- Usé etiquetas **label** correctamente asociadas.
- Mantengo contraste adecuado en los colores del texto.

---
## Pruebas realizadas en navegadores
Probé el formulario en diferentes navegadores para asegurarme de que se ve bien.

| Navegador | Resultado |
|----------|-----------|
| Google Chrome | ✔️ Correcto |
| Mozilla Firefox | ✔️ Correcto |
| Safari | ✔️ Correcto |

---
## Errores y correcciones realizadas
Durante el proceso encontré algunos detalles que corregí:
- Ajusté el estilo del foco del `fieldset`.
- Mejoré el tamaño del input de subida de archivos.
- Ajusté la cuadrícula para pantallas pequeñas.

---
## Pasos realizados
1. Escribí la estructura base del documento HTML.
2. Creé el formulario y agregué los controles.
3. Añadí los estilos CSS para mejorar la presentación.
4. Organicé el contenido con `fieldset`.
5. Añadí validación básica con HTML5.
6. Revisé la accesibilidad básica.
7. Probé en varios navegadores.
8. Elaboré este informe.

---
## Conclusión
Con HTML y CSS, pude crear un formulario completo, organizado y funcional. También aprendí a aplicar conceptos básicos de accesibilidad y usabilidad.

