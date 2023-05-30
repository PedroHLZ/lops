
//    formulario    //

$(document).ready(function () {
    // Intercepta o envio do formulário
    $('#myForm').submit(function (e) {
        e.preventDefault(); // Evita o envio normal do formulário

        var form = $(this);
        var formData = new FormData(form[0]);
        var email = 'playlucas.hlz@gmail.com'; // Endereço de e-mail real

        // Adiciona o endereço de e-mail real aos dados do formulário
        formData.append('email', email);

        // Envia o formulário usando o serviço FormSubmit
        $.ajax({
            url: 'https://formsubmit.co/playlucas.hlz@gmail.com',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (response) {
                // Ação a ser executada quando a resposta do servidor for recebida
                console.log(response); // Exemplo: exibir resposta no console

                // Limpa os campos do formulário
                form.trigger('reset');
            },
            error: function (xhr, status, error) {
                // Ação a ser executada em caso de erro na solicitação
                console.log(error);
            }
        });
    });
});


//    trocar cor    //
const button1 = document.getElementById('change-colors-button-1');
const button2 = document.getElementById('change-colors-button-2');
const button3 = document.getElementById('change-colors-button-3');

button1.addEventListener('click', () => {
    document.documentElement.style.setProperty('--bg-color', '#000c20');
    document.documentElement.style.setProperty('--second-bg-color', '#112e42');
    document.documentElement.style.setProperty('--text-color', '#ededed');
    document.documentElement.style.setProperty('--main-color', '#00abf0');
});

button2.addEventListener('click', () => {
    document.documentElement.style.setProperty('--bg-color', '#FFF4EE');
    document.documentElement.style.setProperty('--second-bg-color', '#BA8475');
    document.documentElement.style.setProperty('--text-color', '#281713');
    document.documentElement.style.setProperty('--main-color', '#ff0000');
});

button3.addEventListener('click', () => {
    document.documentElement.style.setProperty('--bg-color', '#3F4A3C');
    document.documentElement.style.setProperty('--second-bg-color', '#A3AF9E');
    document.documentElement.style.setProperty('--text-color', '#000000');
    document.documentElement.style.setProperty('--main-color', '#00FF00');
});



//    header active nav    //
let sections = document.querySelectorAll('section');
let navLinks = document.querySelectorAll('header nav a');

window.addEventListener('scroll', () => {
    let top = window.scrollY;

    sections.forEach(sec => {
        let offset = sec.offsetTop - 100;
        let height = sec.offsetHeight;
        let id = sec.getAttribute('id');

        if (top >= offset && top < offset + height) {
            navLinks.forEach(link => {
                if (link.getAttribute('href').includes(id)) {
                    link.classList.add("active");
                } else {
                    link.classList.remove("active");
                }
            });
            sec.classList.add("show-animate");
        } else {
            sec.classList.remove("show-animate");
        }
    });
});

// Adicione esse código para tornar o menu responsivo
let menuIcon = document.querySelector('#menu-icon');
let navbar = document.querySelector('.navbar');

menuIcon.addEventListener('click', () => {
    menuIcon.classList.toggle('bx-x');
    navbar.classList.toggle('active');
});

//    header sticks scroll    //
window.addEventListener('scroll', () => {
    let header = document.querySelector("header");
    header.classList.toggle('sticky', window.scrollY > 100);

    //    navbar responsivo remover quando clicar     //
    menuIcon.classList.remove('bx-x');
    navbar.classList.remove('active');
});
//    modal    //
function openModal(modalId) {
    document.getElementById(modalId).style.display = "block";
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
}
