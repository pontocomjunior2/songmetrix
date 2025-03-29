// JavaScript for interactivity on the sales page

document.addEventListener('DOMContentLoaded', function() {
    const ctaButton = document.querySelector('.cta-button');

    ctaButton.addEventListener('click', function(event) {
        event.preventDefault();
        alert('Obrigado por se cadastrar! Você receberá um e-mail com as instruções para o teste grátis.');
    });
});
