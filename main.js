$(document).ready(function ($) {
    "use strict";

    jQuery(".filters").on("click", function () {
        jQuery("#menu-dish").removeClass("bydefault_show");
    });
    $(function () {
        var filterList = {
            init: function () {
                $("#menu-dish").mixItUp({
                    selectors: {
                        target: ".dish-box-wp",
                        filter: ".filter",
                    },
                    animation: {
                        effects: "fade",
                        easing: "ease-in-out",
                    },
                    load: {
                        filter: ".all, .soto, .ayam, .lele, .minumandingin, .minumanhangat",
                    },
                });
            },
        };
        filterList.init();
    });

    jQuery(".menu-toggle").click(function () {
        jQuery(".main-navigation").toggleClass("toggled");
    });

    jQuery(".header-menu ul li a").click(function () {
        jQuery(".main-navigation").removeClass("toggled");
    });

    gsap.registerPlugin(ScrollTrigger);

    var elementFirst = document.querySelector('.site-header');
    ScrollTrigger.create({
        trigger: "body",
        start: "30px top",
        end: "bottom bottom",

        onEnter: () => myFunction(),
        onLeaveBack: () => myFunction(),
    });

    function myFunction() {
        elementFirst.classList.toggle('sticky_head');
    }

    var scene = $(".js-parallax-scene").get(0);
    var parallaxInstance = new Parallax(scene);


});


jQuery(window).on('load', function () {
    $('body').removeClass('body-fixed');

    //activating tab of filter
    let targets = document.querySelectorAll(".filter");
    let activeTab = 0;
    let old = 0;
    let dur = 0.4;
    let animation;

    for (let i = 0; i < targets.length; i++) {
        targets[i].index = i;
        targets[i].addEventListener("click", moveBar);
    }

    // initial position on first === All 
    gsap.set(".filter-active", {
        x: targets[0].offsetLeft,
        width: targets[0].offsetWidth
    });

    function moveBar() {
        if (this.index != activeTab) {
            if (animation && animation.isActive()) {
                animation.progress(1);
            }
            animation = gsap.timeline({
                defaults: {
                    duration: 0.4
                }
            });
            old = activeTab;
            activeTab = this.index;
            animation.to(".filter-active", {
                x: targets[activeTab].offsetLeft,
                width: targets[activeTab].offsetWidth
            });

            animation.to(targets[old], {
                color: "#0d0d25",
                ease: "none"
            }, 0);
            animation.to(targets[activeTab], {
                color: "#fff",
                ease: "none"
            }, 0);

        }

    }
});

const typedTextSpan = document.getElementById('typed-text');
const textArray = ["Soto Ayam Salimnur"];
const typingDelay = 200; // in milliseconds
const erasingDelay = 100; // in milliseconds
const newTextDelay = 2000; // in milliseconds

let textArrayIndex = 0;
let charIndex = 0;

function type() {
    if (charIndex < textArray[textArrayIndex].length) {
        typedTextSpan.textContent += textArray[textArrayIndex].charAt(charIndex);
        charIndex++;
        setTimeout(type, typingDelay);
    } else {
        setTimeout(erase, newTextDelay);
    }
}

function erase() {
    if (charIndex > 0) {
        typedTextSpan.textContent = textArray[textArrayIndex].substring(0, charIndex - 1);
        charIndex--;
        setTimeout(erase, erasingDelay);
    } else {
        textArrayIndex++;
        if (textArrayIndex >= textArray.length) textArrayIndex = 0;
        setTimeout(type, typingDelay);
    }
}

document.addEventListener("DOMContentLoaded", function() { // On DOM Load initiate the effect
    if (textArray.length) setTimeout(type, newTextDelay + 250);
});

function changeMainImage(index) {
    var mainImage = document.getElementById('mainImage');
    var newImageUrl;

    // Tentukan URL gambar baru berdasarkan indeks yang diterima
    if (index === 0) {
        newImageUrl = 'assets/images/ayam-goreng.jpg';
    } else if (index === 1) {
        newImageUrl = 'assets/images/ayambakarsalimnur.jpg';
    } else if (index === 2) {
        newImageUrl = 'assets/images/lelebakarsalimnur.jpg';
    } else if (index === 3) {
        newImageUrl = 'assets/images/lelegorengsalimnur.jpg';
    } else if (index === 4) {
        newImageUrl = 'assets/images/Soto-Ayam-telur.jpeg';
    } else if (index === 5) {
        newImageUrl = 'assets/images/sotoayamcekerssalimnur.jpg';
    }

    // Ubah gambar utama dengan gambar yang baru
    mainImage.style.backgroundImage = "url('" + newImageUrl + "')";
}

 function initMap() {
        // Inisialisasi peta
    var map = L.map('map').setView([-6.175392093812001, 107.00696287498992], 15); // Atur koordinat dan level zoom sesuai kebutuhan Anda

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var marker = L.marker([-6.175392093812001, 107.00696287498992]).addTo(map);
    marker.bindPopup("<b>Our Restaurant</b>").openPopup();

    }

    document.querySelectorAll('nav.header-menu a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();

        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});
