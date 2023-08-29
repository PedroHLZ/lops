
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
            
        }
    });
});

// Adicione esse código para tornar o menu responsivo
function toggleMenu() {
    var navbar = document.getElementById("myNavbar");
    if (navbar.className === "navbar") {
        navbar.className += " responsive";
    } else {
        navbar.className = "navbar";
    }
}

function closeMenu() {
    var navbar = document.getElementById("myNavbar");
    navbar.className = "navbar";
}


//    header sticks scroll    //
window.addEventListener('scroll', () => {
    let header = document.querySelector("header");
    header.classList.toggle('sticky', window.scrollY > 100);

    //    navbar responsivo remover quando clicar     //
    menuIcon.classList.remove('bx-x');
    navbar.classList.remove('active');
});

// Armazenar uma referência para o último card ativo
let lastActiveCard = null;

function toggleDropdown(card) {
  if (lastActiveCard && lastActiveCard !== card) {
    lastActiveCard.classList.remove('active');
  }
  
  card.classList.toggle('active');
  lastActiveCard = card;
}
