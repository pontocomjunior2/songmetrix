import { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import './App.css';

emailjs.init('YOUR_PUBLIC_KEY');
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faMusic, faTrophy, faFileAlt, faBullseye, faMobileAlt, faUsers, faRocket, faChartPie, faLightbulb, faHandshake, faClock, faCheck, faChevronDown, faChevronUp, faPlay, faEnvelope, faPhone, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
import { faFacebookF, faTwitter, faInstagram, faLinkedinIn } from '@fortawesome/free-brands-svg-icons';

import logo from './assets/logo_header.svg';
import logoFooter from './assets/logo_footer.svg';
import heroImg from './assets/hero-image.svg';
import dashboardDemo from './assets/dashboard-demo.svg';
import testimonial1 from './assets/testimonial-1.svg';
import testimonial2 from './assets/testimonial-2.svg';
import testimonial3 from './assets/testimonial-3.svg';

function App() {
  const [faqOpen, setFaqOpen] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [formStatus, setFormStatus] = useState({
    submitting: false,
    submitted: false,
    error: null
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormStatus({ submitting: true, submitted: false, error: null });

    try {
      await emailjs.send(
        'YOUR_SERVICE_ID',
        'YOUR_TEMPLATE_ID',
        {
          to_email: 'contato@songmetrix.com.br',
          from_name: formData.name,
          from_email: formData.email,
          subject: formData.subject,
          message: formData.message
        },
        'YOUR_PUBLIC_KEY'
      );

      setFormStatus({ submitting: false, submitted: true, error: null });
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      setFormStatus({
        submitting: false,
        submitted: false,
        error: 'Ocorreu um erro ao enviar a mensagem. Por favor, tente novamente.'
      });
    }
  };

  useEffect(() => {
    // Script para scroll suave
    const handleSmoothScroll = (e) => {
      const target = e.target;
      if (target.tagName === 'A' && target.getAttribute('href').startsWith('#')) {
        e.preventDefault();
        const id = target.getAttribute('href');
        const element = document.querySelector(id);
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth'
          });
        }
      }
    };

    document.addEventListener('click', handleSmoothScroll);

    return () => {
      document.removeEventListener('click', handleSmoothScroll);
    };
  }, []);

  const toggleFaq = (index) => {
    setFaqOpen(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <>
      <header className="header">
        <div className="container">
          <nav className="navbar">
            <div className="logo">
              <img src={logo} alt="SONGMETRIX Logo" className="logo-img" />
            </div>
            <ul className="nav-menu">
              <li><a href="#funcionalidades">Funcionalidades</a></li>
              <li><a href="#beneficios">Benefícios</a></li>
              <li><a href="#depoimentos">Depoimentos</a></li>
              <li><a href="#faq">FAQ</a></li>
              <li><a href="#contato">Contato</a></li>
            </ul>
            <div className="cta-button">
              <a href="#experimente" className="btn btn-primary">Experimente Grátis</a>
            </div>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">Revolucione a Programação Musical da sua Rádio</h1>
            <h2 className="hero-subtitle">Monitore, analise e otimize sua programação em tempo real com a tecnologia exclusiva do SONGMETRIX</h2>
            <div className="hero-cta">
              <a href="#experimente" className="btn btn-primary btn-lg">Experimente Gratuitamente</a>
              <a href="#demonstracao" className="btn btn-secondary btn-lg">Ver Demonstração</a>
            </div>
          </div>
          <div className="hero-image">
            <img src={heroImg} alt="SONGMETRIX Dashboard" className="hero-img" />
          </div>
        </div>
      </section>

      <section className="features" id="funcionalidades">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Funcionalidades Poderosas</h2>
            <p className="section-subtitle">Tudo o que você precisa para transformar seu repertório musical</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={faChartLine} />
              </div>
              <h3 className="feature-title">Monitoramento em Tempo Real</h3>
              <p className="feature-description">Acompanhe a execução musical da sua rádio e da concorrência em tempo real, com dados precisos e atualizados constantemente.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={faMusic} />
              </div>
              <h3 className="feature-title">Análise de Programação</h3>
              <p className="feature-description">Compare a sua programação musical com a concorrência e também com as plataformas de música. Descubra oportunidades de parcerias estratégicas e analise o que dá certo para sua rádio.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={faTrophy} />
              </div>
              <h3 className="feature-title">Ranking de Músicas</h3>
              <p className="feature-description">Acesse os charts SongMetrix 50, 100 e 200 com as músicas mais tocadas nas rádios de todo o país.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={faFileAlt} />
              </div>
              <h3 className="feature-title">Relatórios Detalhados</h3>
              <p className="feature-description">Gere relatórios personalizados com métricas importantes para tomar decisões estratégicas sobre sua programação.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={faBullseye} />
              </div>
              <h3 className="feature-title">Análise Competitiva</h3>
              <p className="feature-description">Compare sua programação com a concorrência e identifique oportunidades para se destacar no mercado.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={faMobileAlt} />
              </div>
              <h3 className="feature-title">Acesso Multiplataforma</h3>
              <p className="feature-description">Acesse o SONGMETRIX de qualquer dispositivo, a qualquer hora e em qualquer lugar, com interface responsiva e intuitiva.</p>
            </div>

          </div>
        </div>
      </section>

      <section className="demo" id="demonstracao">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Veja o SONGMETRIX em Ação</h2>
            <p className="section-subtitle">Conheça a interface intuitiva e as poderosas ferramentas de análise</p>
          </div>
          <div className="demo-content">
            <div className="demo-video">
              <img src={dashboardDemo} alt="SONGMETRIX Dashboard" className="demo-img" />
              <div className="play-button">
                <FontAwesomeIcon icon={faPlay} />
              </div>
            </div>
            <div className="demo-features">
              <ul className="demo-list">
                <li><FontAwesomeIcon icon={faCheck} /> Dashboard intuitivo com métricas em tempo real</li>
                <li><FontAwesomeIcon icon={faCheck} /> Gráficos e visualizações de dados avançados</li>
                <li><FontAwesomeIcon icon={faCheck} /> Relatórios personalizáveis com exportação em PDF</li>
                <li><FontAwesomeIcon icon={faCheck} /> Comparativo entre rádios e plataformas de streaming</li>
                <li><FontAwesomeIcon icon={faCheck} /> Alertas e notificações personalizáveis</li>
              </ul>
              <a href="#experimente" className="btn btn-primary">Experimente Agora</a>
            </div>

          </div>
        </div>
      </section>

      <section className="benefits" id="beneficios">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Benefícios para sua Rádio</h2>
            <p className="section-subtitle">Como o SONGMETRIX pode transformar sua gestão musical</p>
          </div>
          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">
                <FontAwesomeIcon icon={faUsers} />
              </div>
              <h3 className="benefit-title">Aumente sua Audiência</h3>
              <p className="benefit-description">Com dados precisos sobre o comportamento do público, você pode ajustar sua programação para atrair e reter mais ouvintes.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <FontAwesomeIcon icon={faRocket} />
              </div>
              <h3 className="benefit-title">Otimize sua Programação</h3>
              <p className="benefit-description">Identifique quais músicas têm melhor desempenho e crie playlists mais eficientes para cada horário do dia.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <FontAwesomeIcon icon={faChartPie} />
              </div>
              <h3 className="benefit-title">Tome Decisões Baseadas em Dados</h3>
              <p className="benefit-description">Substitua o "achismo" por análises precisas e tome decisões estratégicas com base em informações concretas.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <FontAwesomeIcon icon={faLightbulb} />
              </div>
              <h3 className="benefit-title">Antecipe Tendências</h3>
              <p className="benefit-description">Identifique músicas em ascensão antes da concorrência e seja o primeiro a tocá-las na sua região.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <FontAwesomeIcon icon={faHandshake} />
              </div>
              <h3 className="benefit-title">Melhore Relacionamentos Comerciais</h3>
              <p className="benefit-description">Apresente relatórios profissionais para gravadoras, artistas e anunciantes, fortalecendo parcerias estratégicas.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <FontAwesomeIcon icon={faClock} />
              </div>
              <h3 className="benefit-title">Economize Tempo</h3>
              <p className="benefit-description">Automatize o monitoramento e análise da programação, liberando sua equipe para atividades mais estratégicas.</p>
            </div>

          </div>
        </div>
      </section>

      <section className="testimonials" id="depoimentos">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">O que Nossos Clientes Dizem</h2>
            <p className="section-subtitle">Histórias de sucesso de profissionais que transformaram suas rádios com o SONGMETRIX</p>
          </div>
          <div className="testimonials-slider">
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p className="testimonial-text">"O SONGMETRIX revolucionou a forma como programamos nossa rádio. Conseguimos aumentar nossa audiência em 30% em apenas 3 meses, identificando tendências e ajustando nossa programação com base nos dados."</p>
              </div>
              <div className="testimonial-author">
                <img src={testimonial1} alt="Carlos Silva" className="testimonial-img" />
                <div className="author-info">
                  <h4 className="author-name">Carlos Silva</h4>
                  <p className="author-role">Diretor de Programação, Rádio Cidade FM</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p className="testimonial-text">"Como programadora musical, o SONGMETRIX se tornou minha ferramenta essencial. Os relatórios detalhados e a análise competitiva me ajudam a tomar decisões mais assertivas e a manter nossa rádio sempre à frente da concorrência."</p>
              </div>
              <div className="testimonial-author">
                <img src={testimonial2} alt="Ana Martins" className="testimonial-img" />
                <div className="author-info">
                  <h4 className="author-name">Ana Martins</h4>
                  <p className="author-role">Programadora Musical, Rádio Jovem Pan</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p className="testimonial-text">"Desde que implementamos o SONGMETRIX, nossa equipe comercial consegue apresentar dados concretos para anunciantes e parceiros. Isso fortaleceu nosso posicionamento no mercado e aumentou nossa receita publicitária em 45%."</p>
              </div>
              <div className="testimonial-author">
                <img src={testimonial3} alt="Roberto Almeida" className="testimonial-img" />
                <div className="author-info">
                  <h4 className="author-name">Roberto Almeida</h4>
                  <p className="author-role">Diretor Comercial, Rede Brasil de Rádios</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>



      <section className="faq" id="faq">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Perguntas Frequentes</h2>
            <p className="section-subtitle">Tire suas dúvidas sobre o SONGMETRIX</p>
          </div>
          <div className="faq-grid">
            <div className="faq-item">
              <div className="faq-question" onClick={() => toggleFaq(1)}>
                <span>Como o SONGMETRIX pode ajudar minha rádio?</span>
                <FontAwesomeIcon icon={faqOpen[1] ? faChevronUp : faChevronDown} />
              </div>
              <div className={`faq-answer ${faqOpen[1] ? 'open' : ''}`}>
                <p>O SONGMETRIX fornece dados em tempo real sobre execuções musicais, permitindo que você tome decisões estratégicas sobre sua programação, acompanhe tendências e se destaque da concorrência. Com nossas ferramentas de análise, você pode otimizar sua playlist, aumentar a audiência e fortalecer relacionamentos comerciais.</p>
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-question" onClick={() => toggleFaq(2)}>
                <span>Quais rádios são monitoradas pelo SONGMETRIX?</span>
                <FontAwesomeIcon icon={faqOpen[2] ? faChevronUp : faChevronDown} />
              </div>
              <div className={`faq-answer ${faqOpen[2] ? 'open' : ''}`}>
                <p>Monitoramos as principais rádios do país. A lista completa está disponível na plataforma e é constantemente atualizada.</p>
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-question" onClick={() => toggleFaq(3)}>
                <span>É possível gerar relatórios personalizados?</span>
                <FontAwesomeIcon icon={faqOpen[3] ? faChevronUp : faChevronDown} />
              </div>
              <div className={`faq-answer ${faqOpen[3] ? 'open' : ''}`}>
                <p>Sim! O SONGMETRIX possui ferramenta de relatórios que permite filtrar dados por período, artista, música, rádio e outros parâmetros.</p>
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-question" onClick={() => toggleFaq(4)}>
                <span>Posso monitorar rádios concorrentes?</span>
                <FontAwesomeIcon icon={faqOpen[4] ? faChevronUp : faChevronDown} />
              </div>
              <div className={`faq-answer ${faqOpen[4] ? 'open' : ''}`}>
                <p>Sim! Dependendo do seu plano, você pode monitorar várias rádios concorrentes e comparar sua programação com a delas. Isso permite identificar oportunidades e ajustar sua estratégia para se destacar no mercado.</p>
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-question" onClick={() => toggleFaq(5)}>
                <span>Que tipo de suporte vocês oferecem?</span>
                <FontAwesomeIcon icon={faqOpen[5] ? faChevronUp : faChevronDown} />
              </div>
              <div className={`faq-answer ${faqOpen[5] ? 'open' : ''}`}>
                <p>Oferecemos suporte técnico especializado e personalizado por email e WhatsApp. Nossa equipe está disponível para ajudar com qualquer dúvida ou problema que você possa ter, garantindo que você aproveite ao máximo o SONGMETRIX.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section className="cta" id="experimente">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Pronto para Revolucionar seu Planejamento Musical?</h2>
            <p className="cta-text">Experimente o SONGMETRIX gratuitamente por 14 dias e descubra como nossa tecnologia pode transformar sua rádio.</p>
            <div className="cta-button-container">
              <a href="https://songmetrix.com.br/login" className="btn btn-primary btn-lg">Criar Minha Conta</a>
            </div>
            <p className="cta-disclaimer">Crie sua conta gratuitamente e comece a transformar a organização do seu repertório.</p>
          </div>
        </div>
      </section>

      <section className="contact" id="contato">
        <div className="container">
          <div className="contact-content">
            <div className="contact-info">
              <h2 className="contact-title">Entre em Contato</h2>
              <p className="contact-text">Estamos à disposição para responder suas dúvidas e ajudar sua rádio a alcançar novos patamares.</p>
              <ul className="contact-list">
                <li>
                  <FontAwesomeIcon icon={faEnvelope} />
                  <a href="mailto:contato@songmetrix.com.br">contato@songmetrix.com.br</a>
                </li>
                <li>
                  <FontAwesomeIcon icon={faPhone} />
                  <a href="tel:+5527998242137">(27) 99824-2137</a>
                </li>
                <li>
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                  <span>Rua Montevidéu, 421 - Araçás, Vila Velha - ES</span>
                </li>
              </ul>
              <div className="social-links">
                <a href="#" className="social-link">
                  <FontAwesomeIcon icon={faFacebookF} />
                </a>
                <a href="#" className="social-link">
                  <FontAwesomeIcon icon={faTwitter} />
                </a>
                <a href="#" className="social-link">
                  <FontAwesomeIcon icon={faInstagram} />
                </a>
                <a href="#" className="social-link">
                  <FontAwesomeIcon icon={faLinkedinIn} />
                </a>
              </div>
            </div>
            <div className="contact-form-container">
              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <input
                    type="text"
                    name="name"
                    placeholder="Nome"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    name="subject"
                    placeholder="Assunto"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <textarea
                    name="message"
                    placeholder="Mensagem"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                  ></textarea>
                </div>
                {formStatus.error && (
                  <div className="form-error">{formStatus.error}</div>
                )}
                {formStatus.submitted && (
                  <div className="form-success">Mensagem enviada com sucesso!</div>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formStatus.submitting}
                >
                  {formStatus.submitting ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
                <button type="submit" className="btn btn-primary">Enviar Mensagem</button>
              </form>
            </div>

          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <img src={logoFooter} alt="SONGMETRIX Logo" className="footer-logo-img" />
              <p className="footer-description">Inteligência Musical para sua rádio.</p>
              <p className="footer-company">Um produto da Pontocom Audio</p>
            </div>
            <div className="footer-links">
              <div className="footer-links-column">
                <h3 className="footer-links-title">Empresa</h3>
                <a href="#">Sobre Nós</a>
                <a href="#">Carreiras</a>
                <a href="#">Blog</a>
                <a href="#">Imprensa</a>
              </div>
              <div className="footer-links-column">
                <h3 className="footer-links-title">Produto</h3>
                <a href="#funcionalidades">Funcionalidades</a>
                <a href="#planos">Planos</a>
                <a href="#">Integrações</a>
                <a href="#">API</a>
              </div>
              <div className="footer-links-column">
                <h3 className="footer-links-title">Recursos</h3>
                <a href="#">Documentação</a>
                <a href="#">Tutoriais</a>
                <a href="#">Webinars</a>
                <a href="#">Suporte</a>
              </div>
              <div className="footer-links-column">
                <h3 className="footer-links-title">Legal</h3>
                <a href="#">Termos de Serviço</a>
                <a href="#">Política de Privacidade</a>
                <a href="#">Cookies</a>
                <a href="#">LGPD</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p className="copyright">© {new Date().getFullYear()} SONGMETRIX. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
